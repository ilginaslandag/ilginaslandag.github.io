// Vercel Sunucusuz Fonksiyon — /api/notify
// Dışarıdan periyodik olarak çağrılır (cron-job.org gibi ücretsiz bir zamanlayıcı).
// Yeni haber varsa ntfy.sh üzerinden telefona bildirim gönderir.
//
// Tekilleştirme kalıcı depo istemez: ntfy'ın kendi mesaj önbelleği hafıza olarak
// kullanılır. Gönderilen her başlık mesaj gövdesinde "• Başlık" satırı olarak
// durur; her çalıştırmada son 12 saatin mesajları okunup o başlıklar atlanır.
import { buildNews } from "../lib/news.js";

const SITE = process.env.SITE_URL || "https://ilginaslandag.github.io";
// Yalnızca bu kadar yeni yayınlanmış haberler bildirim tetikler.
const TAZE_SAAT = 6;
// ntfy önbelleğinden bu kadar geriye bakılır (varsayılan önbellek 12 saat).
const GERIYE_SAAT = 12;
// Tek bir bildirimde en fazla bu kadar başlık listelenir; fazlası ek mesaj olur.
const CHUNK = 10;

// scripts/notify.js ve server.js ile aynı başlık anahtarı
const norm = (t) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçıi]+/g, "").slice(0, 80);

// ntfy önbelleğindeki geçmiş mesajlardan daha önce bildirilen başlıkları çıkarır.
// Dönen: { gonderilmis: Set<string>, mesajVar: boolean }
async function gecmisiOku(topic) {
  const url = `https://ntfy.sh/${encodeURIComponent(topic)}/json?poll=1&since=${GERIYE_SAAT}h`;
  const res = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  if (!res.ok) throw new Error(`ntfy geçmişi okunamadı: HTTP ${res.status}`);
  const metin = await res.text();

  const gonderilmis = new Set();
  let mesajVar = false;
  for (const satir of metin.split("\n")) {
    if (!satir.trim()) continue;
    let olay;
    try {
      olay = JSON.parse(satir);
    } catch {
      continue;
    }
    if (olay.event !== "message") continue;
    mesajVar = true;
    for (const g of String(olay.message || "").split("\n")) {
      if (g.startsWith("• ")) gonderilmis.add(norm(g.slice(2)));
    }
  }
  return { gonderilmis, mesajVar };
}

async function bildirimGonder(topic, baslik, satirlar, sessiz) {
  const res = await fetch("https://ntfy.sh", {
    method: "POST",
    body: JSON.stringify({
      topic,
      title: baslik,
      message: satirlar.join("\n"),
      click: SITE,
      tags: ["chart_with_upwards_trend"],
      // İlk çalıştırmada önbelleği tohumlarken telefonu titretme.
      priority: sessiz ? 1 : 3,
    }),
  });
  if (!res.ok) throw new Error(`ntfy gönderimi başarısız: HTTP ${res.status}`);
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  const gizli = process.env.NOTIFY_SECRET;
  const anahtar = new URL(req.url, "http://localhost").searchParams.get("key");
  // Yapılandırılmamış ya da yanlış anahtar: uç noktanın varlığını sızdırma.
  if (!gizli || anahtar !== gizli) return res.status(404).json({ error: "not found" });

  const topic = process.env.NTFY_TOPIC;
  if (!topic) return res.status(500).json({ error: "NTFY_TOPIC tanımlı değil" });

  try {
    const [{ gonderilmis, mesajVar }, veri] = await Promise.all([gecmisiOku(topic), buildNews()]);

    const simdi = Date.now();
    const yeni = veri.articles.filter((a) => {
      if (gonderilmis.has(norm(a.title))) return false;
      const t = a.date ? new Date(a.date).getTime() : NaN;
      return !isNaN(t) && simdi - t <= TAZE_SAAT * 3600 * 1000;
    });

    if (!yeni.length) return res.status(200).json({ gonderilen: 0, durum: "yeni haber yok" });

    // Önbellek boşsa bu ilk çalıştırmadır: başlıkları sessizce tohumla,
    // yoksa son 6 saatin tamamı tek seferde telefona düşer.
    const sessiz = !mesajVar;

    for (let i = 0; i < yeni.length; i += CHUNK) {
      const parca = yeni.slice(i, i + CHUNK);
      await bildirimGonder(
        topic,
        sessiz ? "Bildirimler etkinleştirildi" : `${yeni.length} yeni haber`,
        parca.map((a) => "• " + a.title.slice(0, 120)),
        sessiz
      );
    }

    return res.status(200).json({ gonderilen: yeni.length, sessiz });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
