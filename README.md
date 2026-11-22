# Parti Odası v0.1
Dosyalar (hepsi aynı klasörde): server.js · index.html · package.json

## Tek bağlantı (bilgisayarsız, telefondan)
1. github.com'da yeni bir depo aç; "uploading an existing file" ile bu 3 dosyayı yükle.
2. render.com → New + → Web Service → depoyu seç.
3. Build Command: `npm install` · Start Command: `npm start` · Plan: Free → Create Web Service.
4. Birkaç dakika sonra çıkan `https://….onrender.com` adresi tek bağlantındır. Onu arkadaşlara gönder.
Not: ücretsiz planda 15 dk boşta kalınca uyur, ilk açılış yavaştır. Odalar bellektedir; yeniden başlatmada silinir.

## Bilgisayardan
`npm install && npm start` → http://localhost:3000
Aynı anda internete açmak için ikinci terminalde: `cloudflared tunnel --url http://localhost:3000`
