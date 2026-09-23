// GitHub Actions'ta fetch-news.js'ten SONRA, yayından ÖNCE çalışır:
// canlıdaki (eski) news.json ile yeni üretileni karşılaştırır,
// yeni haber varsa ntfy.sh üzerinden telefona özet bildirimi gönderir.
// Bildirim hatası yayını asla engellemez (her durumda 0 ile çıkar).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TOPIC = process.env.NTFY_TOPIC;
const SITE = "https://ilginaslandag.github.io";

// server.js'teki tekilleştirme ile aynı başlık anahtarı
const norm = (t) => t.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçıi]+/g, "").slice(0, 80);

(async () => {
  if (!TOPIC) {
    console.log("NTFY_TOPIC tanımlı değil, bildirim atlanıyor (yerel çalıştırma).");
    return;
  }
  const fresh = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "public", "news.json"), "utf8"));

  let baseline;
  try {
    const res = await fetch(SITE + "/news.json", { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    baseline = await res.json();
  } catch (err) {
    console.log(`Önceki yayın okunamadı (${err.message}) — ilk çalıştırma varsayılıyor, bildirim atlanıyor.`);
    return;
  }

  const seen = new Set(baseline.articles.map((a) => norm(a.title)));
  // Yalnızca son 24 saatte yayınlanan haberler bildirim tetikler. Bir kaynak
  // geçici düşüp toparladığında eski haberler baseline'dan çıkıp geri gelse bile
  // (ya da tarihsiz bir öğe "şu an" damgası alsa bile) eskiyi "yeni" diye pushlamaz.
  const TAZE_MS = 24 * 60 * 60 * 1000;
  const simdi = Date.now();
  const yeni = fresh.articles.filter((a) => {
    if (seen.has(norm(a.title))) return false;
    const t = a.date ? new Date(a.date).getTime() : NaN;
    return !isNaN(t) && simdi - t <= TAZE_MS;
  });
  if (!yeni.length) {
    console.log("Yeni haber yok, bildirim gönderilmedi.");
    return;
  }

  const basliklar = yeni.slice(0, 3).map((a) => "• " + a.title.slice(0, 90)).join("\n");
  const res = await fetch("https://ntfy.sh", {
    method: "POST",
    body: JSON.stringify({
      topic: TOPIC,
      title: `${yeni.length} yeni haber`,
      message: basliklar,
      click: SITE,
      tags: ["chart_with_upwards_trend"],
    }),
  });
  console.log(`Bildirim gönderildi (HTTP ${res.status}): ${yeni.length} yeni haber.`);
})().catch((err) => {
  console.error("Bildirim hatası (yayını engellemez):", err.message);
});
