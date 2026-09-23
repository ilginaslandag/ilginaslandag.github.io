// Haber toplama çekirdeği — saf JS, Node'a özgü API kullanmaz.
// Hem yerel sunucu (server.js), hem Vercel fonksiyonu (api/news.js),
// hem de statik yedek üreteci (scripts/fetch-news.js) buradan beslenir.

const FETCH_TIMEOUT_MS = 12000;
// ---------------------------------------------------------------------------
// Kaynaklar — buraya yeni RSS kaynağı ekleyebilirsin.
// category: varsayılan kategori; başlık/özet içeriğine göre otomatik de atanır.
// ---------------------------------------------------------------------------
const FEEDS = [
  // ── Türkiye ──────────────────────────────────────────────────────────────
  { id: "bloomberght", name: "Bloomberg HT", region: "tr", category: "borsa",
    url: "https://www.bloomberght.com/rss" },
  { id: "aa-ekonomi", name: "Anadolu Ajansı Ekonomi", region: "tr", category: "ekonomi",
    url: "https://www.aa.com.tr/tr/rss/default?cat=ekonomi" },
  { id: "hurriyet-eko", name: "Hürriyet Ekonomi", region: "tr", category: "ekonomi",
    url: "https://www.hurriyet.com.tr/rss/ekonomi" },
  { id: "dunya", name: "Dünya Gazetesi", region: "tr", category: "ekonomi",
    url: "https://www.dunya.com/rss" },
  { id: "gnews-bist", name: "Google News · Borsa İstanbul", region: "tr", category: "borsa",
    url: "https://news.google.com/rss/search?q=%22borsa%20istanbul%22%20OR%20BIST&hl=tr&gl=TR&ceid=TR:tr" },
  { id: "gnews-altin", name: "Google News · Altın", region: "tr", category: "altin",
    url: "https://news.google.com/rss/search?q=%22gram%20alt%C4%B1n%22%20OR%20%22ons%20alt%C4%B1n%22%20OR%20%22alt%C4%B1n%20fiyat%22&hl=tr&gl=TR&ceid=TR:tr" },
  { id: "gnews-tr-eko", name: "Google News · TR Ekonomi", region: "tr", category: "ekonomi",
    url: "https://news.google.com/rss/headlines/section/topic/BUSINESS?hl=tr&gl=TR&ceid=TR:tr" },

  // ── Dünya ────────────────────────────────────────────────────────────────
  { id: "yahoo", name: "Yahoo Finance", region: "global", category: "borsa",
    url: "https://finance.yahoo.com/news/rssindex" },
  { id: "cnbc", name: "CNBC Top News", region: "global", category: "borsa",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114" },
  { id: "cnbc-markets", name: "CNBC Markets", region: "global", category: "borsa",
    url: "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=20910258" },
  { id: "marketwatch", name: "MarketWatch", region: "global", category: "borsa",
    url: "https://feeds.content.dowjones.io/public/rss/mw_topstories" },
  { id: "wsj-markets", name: "WSJ Markets", region: "global", category: "borsa",
    url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml" },
  { id: "investing-stocks", name: "Investing.com Hisse", region: "global", category: "borsa",
    url: "https://www.investing.com/rss/news_25.rss" },
  { id: "investing-commod", name: "Investing.com Emtia", region: "global", category: "altin",
    url: "https://www.investing.com/rss/news_11.rss" },
  // Mining.com, GitHub Actions IP'lerini 403 ile engellediği için Google News üzerinden alınıyor.
  { id: "gnews-mining", name: "Google News · Gold Mining", region: "global", category: "altin",
    url: "https://news.google.com/rss/search?q=%22gold%20mining%22%20OR%20%22gold%20miners%22&hl=en-US&gl=US&ceid=US:en" },
  { id: "gnews-gold", name: "Google News · Gold", region: "global", category: "altin",
    url: "https://news.google.com/rss/search?q=%22gold%20price%22%20OR%20%22gold%20market%22&hl=en-US&gl=US&ceid=US:en" },
  { id: "gnews-markets", name: "Google News · Markets", region: "global", category: "borsa",
    url: "https://news.google.com/rss/search?q=%22stock%20market%22%20OR%20%22wall%20street%22&hl=en-US&gl=US&ceid=US:en" },
];

// ---------------------------------------------------------------------------
// Kategori tespiti (başlık + özet üzerinden anahtar kelime)
// ---------------------------------------------------------------------------
const CATEGORY_RULES = [
  { cat: "altin", words: ["altın", "altin", "gram altın", "ons", "gold", "xau", "silver", "gümüş", "precious metal", "bullion"] },
  { cat: "borsa", words: ["borsa", "bist", "hisse", "endeks", "stock", "stocks", "equity", "equities", "nasdaq", "s&p", "dow jones", "wall street", "shares", "ipo", "halka arz", "temettü", "dividend"] },
  { cat: "doviz", words: ["dolar", "euro", "sterlin", "kur ", "döviz", "forex", "currency", "exchange rate", "usd", "eur/", "parite"] },
  { cat: "kripto", words: ["bitcoin", "kripto", "crypto", "ethereum", "btc", "altcoin", "blockchain"] },
  { cat: "ekonomi", words: ["enflasyon", "inflation", "faiz", "merkez bankası", "central bank", "fed ", "tcmb", "ecb", "gdp", "büyüme", "recession", "resesyon", "tarife", "tariff"] },
];

function detectCategory(text, fallback) {
  const t = " " + text.toLocaleLowerCase("tr") + " ";
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((w) => t.includes(w))) return rule.cat;
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// RSS / Atom ayrıştırma (regex tabanlı, toleranslı)
// ---------------------------------------------------------------------------
function stripCdata(s) {
  return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s) {
  // Bazı kaynaklar entity'leri çift kodlar (&amp;#39; gibi) — iki geçişte çöz.
  return decodeEntities(decodeEntities(stripCdata(s))).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function pickTag(block, tags) {
  for (const tag of tags) {
    const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
    if (m && m[1].trim()) return m[1].trim();
  }
  return "";
}

function pickAtomLink(block) {
  const alt = block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
  if (alt) return alt[1];
  const any = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  return any ? any[1] : "";
}

function parseFeed(xml) {
  const items = [];
  const blocks = xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ||
                 xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) || [];
  for (const block of blocks) {
    const title = stripHtml(pickTag(block, ["title"]));
    if (!title) continue;
    let link = stripCdata(pickTag(block, ["link"])).trim();
    if (!link || link.startsWith("<")) link = pickAtomLink(block);
    link = decodeEntities(link);
    const dateRaw = stripCdata(pickTag(block, ["pubDate", "published", "updated", "dc:date"])).trim();
    let desc = stripHtml(pickTag(block, ["description", "summary", "content:encoded", "content"])).slice(0, 300);
    // Açıklama başlığın kopyasıysa ve kayda değer ek bilgi içermiyorsa gösterme
    // (Google News açıklamaları başlık + kaynak adından ibarettir).
    const fold = (x) => x.toLocaleLowerCase("tr").replace(/[^\p{L}\p{N}]+/gu, "");
    const nt = fold(title);
    const nd = fold(desc);
    if (nd && nd.length <= nt.length + 40 && (nd.startsWith(nt.slice(0, 60)) || nt.startsWith(nd))) desc = "";
    const date = dateRaw ? new Date(dateRaw) : null;
    items.push({
      title,
      link,
      description: desc,
      date: date && !isNaN(date) ? date.toISOString() : null,
    });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Getirme + önbellek
// ---------------------------------------------------------------------------
async function fetchFeedOnce(feed) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(feed.url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
        "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseFeed(xml);
    const now = Date.now();
    return {
      ok: true,
      items: items.map((it) => ({
        ...it,
        date: it.date || new Date(now).toISOString(),
        source: feed.name,
        sourceId: feed.id,
        region: feed.region,
        category: detectCategory(it.title + " " + it.description, feed.category),
      })),
    };
  } catch (err) {
    return { ok: false, error: err.message, items: [] };
  } finally {
    clearTimeout(timer);
  }
}

// Geçici hatalara (zaman aşımı, anlık 5xx) karşı bir kez daha dene.
async function fetchFeed(feed) {
  const first = await fetchFeedOnce(feed);
  if (first.ok && first.items.length) return first;
  await new Promise((r) => setTimeout(r, 2000));
  const second = await fetchFeedOnce(feed);
  return second.ok && second.items.length ? second : first;
}

let cache = { ts: 0, payload: null, refreshing: null };

async function buildNews() {
  const results = await Promise.all(FEEDS.map((f) => fetchFeed(f)));
  const seen = new Set();
  const articles = [];
  results.forEach((r) => {
    for (const item of r.items) {
      const key = item.title.toLocaleLowerCase("tr").replace(/[^a-z0-9ğüşöçıi]+/g, "").slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      articles.push(item);
    }
  });
  articles.sort((a, b) => new Date(b.date) - new Date(a.date));
  const sources = FEEDS.map((f, i) => ({
    id: f.id, name: f.name, region: f.region,
    ok: results[i].ok, count: results[i].items.length,
    error: results[i].ok ? null : results[i].error,
  }));
  return { updatedAt: new Date().toISOString(), articles: articles.slice(0, 900), sources };
}

export { FEEDS, buildNews, parseFeed, detectCategory };
