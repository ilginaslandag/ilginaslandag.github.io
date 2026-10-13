# 📈 Borsa Haber Merkezi

Farklı kaynaklardan (Türkiye + dünya) borsa, altın, döviz ve yatırım haberlerini tek arayüzde toplayan kişisel haber merkezi. Hiçbir bağımlılık gerektirmez.

## Çalıştırma

```bash
node local-server.js
```

Sonra tarayıcıda **http://localhost:3939** adresini aç.

Farklı bir port için: `PORT=8080 node local-server.js`

## Özellikler

- **17 kaynak**: Bloomberg HT, Anadolu Ajansı, Hürriyet Ekonomi, Dünya Gazetesi, Yahoo Finance, CNBC, MarketWatch, WSJ, Investing.com, Mining.com + Google News aramaları (BIST, altın, gold, markets)
- **Kategori filtreleri**: Borsa · Altın & Emtia · Döviz · Ekonomi · Kripto (başlık/özet içeriğine göre otomatik etiketlenir)
- **Bölge filtresi**: 🇹🇷 Türkiye / 🌐 Dünya
- **Arama**, **5 dakikada bir otomatik yenileme**, elle "Yenile" butonu
- Alt barda her kaynağın canlı durumu (yeşil = çalışıyor, kırmızı = hata)
- Aynı haberin farklı kaynaklardaki kopyaları otomatik ayıklanır

## Kaynak ekleme / çıkarma

`server.js` içindeki `FEEDS` dizisine yeni bir satır ekle:

```js
{ id: "benzersiz-id", name: "Görünen Ad", region: "tr" /* veya "global" */,
  category: "borsa", url: "https://ornek.com/rss" },
```

Sunucu RSS ve Atom formatlarını destekler; kaynak sonuçları 5 dakika önbelleklenir.

## Mimari ve otomatik tetikleme (2026-10)

Site iki adreste yayında; ikisi de aynı koddan beslenir:

| Adres | Nasıl taze kalır |
|---|---|
| **https://borsa-haber-merkezi.vercel.app** | `api/news.js` haberleri *istek anında* çeker (CDN önbelleği 3 dk). Hiçbir zamanlayıcıya bağlı değildir. |
| **https://ilginaslandag.github.io** | Ön yüz önce Vercel API'sini okur (her zaman taze); API erişilemezse Actions'ın ürettiği `news.json`'a düşer. |

Telefon bildirimleri `api/notify.js` üzerinden gider; tekilleştirme hafızası ntfy mesaj geçmişidir, bu yüzden
birden fazla tetikleyici aynı ucu çağırsa bile aynı haber iki kez düşmez. Çağrı başına en fazla **bir** görünür bildirim.

GitHub'ın ücretsiz cron zamanlayıcısı bu repoda planlı çalışmaların ~%95'ini atladığı için tetikleme katmanlıdır:

1. **Claude bulut bekçisi** (saatlik, Mac'ten bağımsız): Vercel'deki `/api/tetik?key=…` ucunu çağırır. Uç, GitHub
   PAT'ı ile (yalnızca Vercel env'inde `GH_PAT`) deploy.yml'i tetikler ve run'ın *gerçekten* oluştuğunu doğrular
   (204 yetmez); kapatılmış iş akışını yeniden açar. Bulut ortamının GitHub kimliği API'de salt okunur olduğu ve
   proxy her Authorization başlığını ezdiği için bekçi GitHub'a doğrudan yazamaz — bu yüzden PAT Vercel'de durur.
   Gereksinim: claude.ai/code → Environments → Default → Network access'e `borsa-haber-merkezi.vercel.app` eklenmeli.
   Tetikleyemezse yalnızca o zaman Claude uygulaması üzerinden push uyarısı atar.
1b. **Ziyaretçi odaklı tetikleme** (zamanlayıcısız): `/api/news` CDN önbelleği dolup yeniden çalıştığında (≤3 dk'da bir,
   herhangi bir ziyaret ya da açık sekmenin 5 dk'lık otomatik yenilemesi) Pages yayını 20 dk'dan eskiyse workflow'u
   başlatır. Site kullanıldığı sürece kendi kendini tazeler.
2. **deploy.yml cron** (`3,18,33,48`) + **tetikleyici.yml** (`11,41` ve `26,56`, `GITHUB_TOKEN` ile dispatch) — ikisi de
   aynı güvenilmez GitHub zamanlayıcısına bağlı ek "piyango bileti"; bağımsız güvence değil, ücretsiz oldukları için duruyorlar.
3. **60 gün kuralı (reaktif, sahte commit YOK)**: GitHub, public repoda 60 gün commit olmazsa zamanlayıcıyı
   `disabled_inactivity` yapar (önce e-posta uyarısı gönderir). Sahte commit üreten "keepalive" kalıbını GitHub ToS
   ihlali sayıp ilgili araçların depolarını kapattı; bu yüzden burada kullanılmaz. Bulut bekçisi kapanmayı görürse
   belgelenmiş `PUT …/actions/workflows/{id}/enable` ucuyla yeniden açıp dispatch eder. Vercel kopyası etkilenmez.
4. **Yerel görev** (`borsa-haber-tetikleyici`, 15 dk): yalnızca bu Mac'te Claude uygulaması açıkken ek katman.

Vercel'e deploy: `npx vercel --prod` (proje `borsa-haber-merkezi`; env: `NTFY_TOPIC`, `NOTIFY_SECRET`, `SITE_URL`).
Not: Vercel, kökteki `server.js`'i Node sunucu giriş noktası sanıp fonksiyonları derlemez — bu yüzden yerel sunucu
`local-server.js` adındadır ve `vercel.json`'da `framework: null` ayarlıdır.
