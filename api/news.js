// Vercel Sunucusuz Fonksiyon — /api/news
// Haberleri istek anında çeker. Tazelik CDN önbelleğiyle dengelenir:
// ziyaretçi her zaman anında yanıt alır, fonksiyon ise ~3 dakikada bir çalışır.
import { buildNews } from "../lib/news.js";

// CDN bu süre boyunca önbellekten servis eder.
const CDN_TTL_S = 180;
// Süre dolduğunda: eski veriyi anında ver, arka planda tazele.
const STALE_WHILE_REVALIDATE_S = 600;

export default async function handler(req, res) {
  const force = new URL(req.url, "http://localhost").searchParams.get("refresh") === "1";

  try {
    const data = await buildNews();
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      force
        ? "no-store"
        : `public, s-maxage=${CDN_TTL_S}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_S}`
    );
    res.status(200).send(JSON.stringify(data));
  } catch (err) {
    // Hata yanıtı önbelleğe girmemeli; ön yüz news.json yedeğine düşer.
    res.setHeader("Cache-Control", "no-store");
    res.status(500).json({ error: err.message });
  }
}
