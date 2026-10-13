// Borsa Haber Merkezi — yerel geliştirme sunucusu
// Çalıştırma: node server.js  →  http://localhost:3939
// Bağımlılık yok; Node 18+ yeterli.
// Haber mantığı lib/news.js içinde; burası yalnızca yerel önizleme içindir.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildNews } from "./lib/news.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3939;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 dakika

let cache = { ts: 0, payload: null, refreshing: null };

async function getNews(force) {
  const fresh = cache.payload && Date.now() - cache.ts < CACHE_TTL_MS;
  if (fresh && !force) return cache.payload;
  if (!cache.refreshing) {
    cache.refreshing = buildNews().then((payload) => {
      cache = { ts: Date.now(), payload, refreshing: null };
      return payload;
    }).catch((err) => {
      cache.refreshing = null;
      throw err;
    });
  }
  // Eski veri varsa onu hemen döndür, arka planda yenile (force hariç)
  if (cache.payload && !force) return cache.payload;
  return cache.refreshing;
}

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/api/news") {
    try {
      const data = await getNews(url.searchParams.get("refresh") === "1");
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Statik dosyalar
  let file = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(__dirname, "public", path.normalize(file).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(path.join(__dirname, "public"))) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => {
  console.log(`Borsa Haber Merkezi → http://localhost:${PORT}`);
});
