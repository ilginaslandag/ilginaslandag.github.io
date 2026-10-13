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
