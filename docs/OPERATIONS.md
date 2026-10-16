# İşletim ve sürüm doğrulama — Salt okunur GitHub Actions izleme

Son inceleme: **16 Ekim 2026**. Bu belge kurulum, veri akışı, sürüm kapıları, geri dönüş ve doğrulama kapsamını birlikte kaydeder. Bir yayın adresinin açılması, tüm üretim koşullarının tamamlandığı anlamına gelmez.

## Sürüm kanıtı

- Denetlenen uygulama commit’i: `0e3f44be6a4c3adf743a035b9bb5975f5a6d66d6`.
- [Bu commit için başarılı CI kaydı](https://github.com/busrabuseucar/action-watch/actions/runs/38910987534).
- Doğrulanan otomatik kapsam: 31 Node + 1 paket + 6 tarayıcı testi.
- Testlerin gerçek servis, veri veya donanım yerine taklit kullandığı noktalar aşağıda açıkça ayrılmıştır.

## Kurulum ve çalışma

Depo kökünde, README’deki çalışma zamanı sürümüyle:

```sh
npm ci
npm run check
npm run build
npm test
npm run source
```

Veri akışı: Tarayıcı → herkese açık GitHub Actions REST yanıtı → durum normalizasyonu → çalıştırma ve iş adımları.

Yapılandırma: Statik dist yayını. GitHub tokenı girilmez; özel depolar kapsam dışı. Önbellek 60 saniye, otomatik yenileme yok.

## Yayın ve geri dönüş

1. Temiz checkout ve kilitli bağımlılıklarla yukarıdaki kontrolleri çalıştır. İlgili CI başarısını commit SHA ile eşleştir.
2. Yayın paketine yalnızca çalışma zamanı dosyalarını koy. Secret, ham kullanıcı verisi, yerel veritabanı ve kişisel hazırlık notları pakete girmemeli.
3. Hedef proje, kaynak commit, ortam ve yayın sürümünü kaydet. Önceki çalışan sürüm kimliğini geri dönüş için koru.
4. Yayından sonra ana kullanıcı akışını, hata durumunu ve varsa kalıcılığı doğrula. Sunucu hatası/yanlış sonuçta yeni yazmaları durdur; önceki doğrulanmış yayını geri al.
5. Şema değiştiyse yalnızca kodu geri almak yeterli değildir. Yedekten ayrı ortamda doğrulama yapmadan canlı veri üzerine yazma.

## Veri saklama ve kurtarma

Kalıcı uygulama veritabanı yok. GitHub kaynak kayıtları otoritedir; tarayıcı önbelleği yedek değildir.

## Gerçek servis, model ve cihaz doğrulaması

16 Ekim canlı tarayıcı kontrolünde busrabuseucar/csv-doctor için 6 gerçek çalıştırma ve 38909636233 iş adımları yüklendi. Örnek modunu gerçek API kanıtı sayma. 403/429 durumunda sınırlamayı göster, sonsuz tekrar yapma.

## Yayın sonrası gözlem

Önce küçük ve sentetik girdilerle temel akışı kontrol et. Beklenmeyen hata, boş ekran, yanlış hesap, yetkisiz erişim veya veri kaybında tarih, uygulama commit’i, ortam ve yeniden üretme adımlarını kaydet; kişisel veri ve secret ekleme. Statik araçlarda tarayıcı konsolu/ağ hatalarını; backend bulunan projelerde durum kodu, gecikme ve hata oranını incele. Bu belgede sürekli izleme veya otomatik geri dönüş kurulmuş olduğu iddia edilmez.

## Kabul kaydı

Her yeni sürümün kaydı; test komutu/sonucu, kaynak SHA, yayın sürümü, gerçek servis/model sürümü, cihaz/işletim sistemi, veri kümesi özeti ve geri dönüş denemesini içermeli. Erişim veya fiziksel donanım yoksa ilgili satır **çalıştırılmadı** olarak tutulur; otomatik test başarısı yerine geçirilmez.
