// Vercel Sunucusuz Fonksiyon — /api/news
// Haberleri istek anında çeker. Tazelik CDN önbelleğiyle dengelenir:
// ziyaretçi her zaman anında yanıt alır, fonksiyon ise ~3 dakikada bir çalışır.
import { buildNews } from "../lib/news.js";
import { tetikle } from "../lib/tetik.js";

// CDN bu süre boyunca önbellekten servis eder.
const CDN_TTL_S = 180;
// Süre dolduğunda: eski veriyi anında ver, arka planda tazele.
const STALE_WHILE_REVALIDATE_S = 600;

export default async function handler(req, res) {
  const force = new URL(req.url, "http://localhost").searchParams.get("refresh") === "1";

  try {
    const data = await buildNews();
    // Ziyaretçi odaklı tetikleme: bu fonksiyon yalnızca CDN önbelleği dolunca çalışır
    // (en sık ~3 dk'da bir). GitHub Pages yayını 20 dk'dan eskiyse ve sürmüyorsa
    // workflow'u başlatır — hiçbir zamanlayıcıya bağlı olmayan ek katman.
    // Doğrulama beklenmez (yanıt gecikmesin); dispatch ~1 sn sürer.
    if (process.env.GH_PAT && !force) {
      try {
        data.tetik = await Promise.race([
          tetikle({ dogrula: false }),
          new Promise((r) => setTimeout(() => r({ tetiklendi: false, hata: "zaman aşımı" }), 6000)),
        ]);
      } catch (err) {
        data.tetik = { tetiklendi: false, hata: err.message };
      }
    }
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    // GitHub Pages kopyası (ilginaslandag.github.io) bu API'yi çapraz kaynaktan çağırır.
    res.setHeader("Access-Control-Allow-Origin", "*");
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
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(500).json({ error: err.message });
  }
}
