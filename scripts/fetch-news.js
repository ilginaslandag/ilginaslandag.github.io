// Statik yedek üreteci: public/news.json dosyasını yazar.
// Vercel'de derleme adımı olarak çalışır — /api/news erişilemezse ön yüz
// bu dosyaya düşer (index.html içindeki yedek yol).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNews } from "../lib/news.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

buildNews()
  .then((data) => {
    const out = path.join(__dirname, "..", "public", "news.json");
    fs.writeFileSync(out, JSON.stringify(data));
    const fails = data.sources.filter((s) => !s.ok || !s.count);
    console.log(`news.json yazıldı: ${data.articles.length} haber, ${data.sources.length - fails.length}/${data.sources.length} kaynak çalışıyor`);
    fails.forEach((s) => console.log(`  UYARI: ${s.name} → ${s.error || "0 haber"}`));
    process.exit(0);
  })
  .catch((err) => {
    console.error("Haber çekme başarısız:", err);
    process.exit(1);
  });
