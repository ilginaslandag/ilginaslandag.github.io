// GitHub Pages yayınını (deploy.yml) dışarıdan tetikleme çekirdeği.
// Vercel'de çalışır; PAT yalnızca Vercel env'inde (GH_PAT) durur.
// Kullananlar: api/tetik.js (bulut bekçisi / dış zamanlayıcı) ve api/news.js (ziyaretçi odaklı).
const REPO = "ilginaslandag/ilginaslandag.github.io";
const API = `https://api.github.com/repos/${REPO}`;
const ESIK_DK = 20; // son başarılı yayın bundan yeniyse tetikleme

async function gh(path, opts = {}) {
  return fetch(API + path, {
    ...opts,
    headers: {
      Authorization: `Bearer ${process.env.GH_PAT}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "borsa-haber-tetik",
      ...(opts.headers || {}),
    },
  });
}
const json = async (r) => (r.ok ? r.json() : null);

export async function tetikle({ zorla = false, dogrula = true } = {}) {
  if (!process.env.GH_PAT) return { tetiklendi: false, hata: "GH_PAT tanımlı değil" };

  // Kapatılmış iş akışını (60 gün kuralı vb.) resmi uçla yeniden aç.
  const wf = await json(await gh("/actions/workflows/deploy.yml"));
  let enable = null;
  if (wf && wf.state && wf.state !== "active") enable = (await gh("/actions/workflows/deploy.yml/enable", { method: "PUT" })).status;

  const suren = (await json(await gh("/actions/workflows/deploy.yml/runs?status=in_progress&per_page=1")))?.total_count || 0;
  const kuyruk = (await json(await gh("/actions/workflows/deploy.yml/runs?status=queued&per_page=1")))?.total_count || 0;
  const son = (await json(await gh("/actions/workflows/deploy.yml/runs?status=success&per_page=1")))?.workflow_runs?.[0];
  const dk = son ? Math.round((Date.now() - new Date(son.created_at)) / 60000) : 9999;
  const ozet = { sonBasarili: son?.created_at || null, sonBasariliDkOnce: dk, suren: suren + kuyruk, enable, durum: wf?.state || null };

  if (!zorla && (suren + kuyruk > 0 || dk < ESIK_DK)) {
    return { tetiklendi: false, neden: suren + kuyruk > 0 ? "yayın zaten sürüyor" : `son yayın ${dk} dk önce (eşik ${ESIK_DK})`, ...ozet };
  }

  const t0 = Date.now();
  const d = await gh("/actions/workflows/deploy.yml/dispatches", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: "main" }),
  });
  if (d.status !== 204) return { tetiklendi: false, hata: `dispatch HTTP ${d.status}`, ...ozet };
  if (!dogrula) return { tetiklendi: true, dogrulandi: null, ...ozet };

  // 204, run oluştuğunu garanti etmez — gerçekten oluştu mu bak.
  await new Promise((r) => setTimeout(r, 8000));
  const yeni = (await json(await gh("/actions/workflows/deploy.yml/runs?event=workflow_dispatch&per_page=1")))?.workflow_runs?.[0];
  const dogrulandi = !!yeni && new Date(yeni.created_at).getTime() >= t0 - 5000;
  return { tetiklendi: true, dogrulandi, run: yeni?.html_url || null, ...ozet };
}
