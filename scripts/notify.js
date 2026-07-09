// GitHub Actions'ta fetch-news.js'ten SONRA, yayından ÖNCE çalışır:
// canlıdaki (eski) news.json ile yeni üretileni karşılaştırır,
// yeni haber varsa ntfy.sh üzerinden telefona özet bildirimi gönderir.
// Bildirim hatası yayını asla engellemez (her durumda 0 ile çıkar).
const fs = require("fs");
const path = require("path");

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
  const yeni = fresh.articles.filter((a) => !seen.has(norm(a.title)));
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
