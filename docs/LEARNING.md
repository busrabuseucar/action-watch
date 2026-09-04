# ActionWatch — uygulayarak öğren

Bu projede hedef; bir dış servisten veri okuma, başarısız istekleri yönetme ve yanlış başarı oranı üretmeme davranışlarını açıklayabilmek. Proje yapay zekâ desteğiyle hazırlandı; kendi katkını incelediğin, değiştirdiğin ve doğruladığın iş üzerinden anlat.

## 1. Örnek senaryoyu karşılaştır

1. Demoyu aç. **ÖRNEK VERİ · CANLI DEĞİL** etiketini görmelisin.
2. Özet: 4 başarılı, 2 başarısız, 1 devam eden, 1 iptal edilen; başarı oranı **%67**.
3. `#47 · Test başarısız` düğmesine bas. Birim testleri başarısız, sonraki derleme adımı atlanmış olmalı.
4. Hatalı koşulu oku: `result !== 'failure'`. Bu koşul, `cancelled` için de doğru döner.
5. `#48 · Düzeltme sonrası` düğmesine bas. `result === 'success'` yalnızca gerçek başarıyı kabul eder.

Örnek veriler canlı bir depodan çekilmez. Panelde gördüğün öğretici kod gerçek GitHub logu değildir.

## 2. Kendi projendeki gerçek sonucu gör

1. `CSV Doctor` kısayoluna bas veya `busrabuseucar/csv-doctor` yazıp `GitHub’dan getir` düğmesine bas.
2. Etiket **GITHUB VERİSİ** olmalı. Gösterilen tarih, son görüntünün alınma zamanıdır; yanıt en fazla 60 saniye önbellekten gelebilir.
3. Çalıştırmayı seç ve `Bu çalıştırmayı GitHub’da aç` bağlantısıyla kaydı karşılaştır.
4. İş adımlarını aç. Bir çalıştırma tekrar çalıştırıldıysa panel, seçili denemenin adımlarını getirir.
5. Sonuç / iş akışı / dal filtrelerini dene. Özet kartları son 30 kaydın tamamını esas alır; filtreli listenin özetine dönüşmez.

API sınırına ulaşırsan hata mesajını oku. Sürekli yeniden denemek yerine bildirilen zamanı bekle veya örnek modu kullan. Uygulama erişim anahtarı istemez.

## 3. Gerçek GitHub Actions başarısızlığı üret

Bu adım kaynaklar kendi depona yüklendikten sonra yapılır. Ana iş akışını veya uygulamayı bozmaz; bağımsız ve elle başlatılan bir öğrenme deneyi çalıştırır.

1. Deponun **Actions** sekmesini aç.
2. **CI learning lab** iş akışını seç.
3. **Run workflow** altında `scenario: broken` seç ve başlat. Testin başarısız olması beklenir.
4. Aynı iş akışını `scenario: fixed` seçerek yeniden başlat. Bu sefer test geçmeli.
5. ActionWatch’ta kendi `kullanıcı/action-watch` deponu getir. İş akışını `CI learning lab` olarak filtrele. İki ayrı çalıştırmayı ve test adımlarını karşılaştır.

Bu iki çalıştırma kendiliğinden başlatılmaz. Actions kullanım koşulları hesabına göre geçerlidir.

## 4. Kod okuma sırası

1. `src/domain.ts` → `groupOf` ve `summary`: iptal ve bekleyen sonuçlar neden paydaya alınmıyor?
2. `normalizeRuns` ve `normalizeJobs`: TypeScript tipi tek başına internetten gelen verinin doğru olduğunu kanıtlar mı?
3. `src/github.ts` → `runs`, `jobs`, `request`: hangi URL’ler çağrılıyor, hata ve kota bilgisi nereden okunuyor?
4. `src/session.ts`: önceki istek geç biterse yeni seçimin üstüne yazmasını ne engelliyor?
5. `src/app.ts`: metinleri HTML olarak basmak yerine `textContent` kullanılması neyi korur?
6. `tests/`: gerçek ağı kullanmadan 404, 429 ve zaman aşımı nasıl üretiliyor?

## Mülakatta anlat

- Çalıştırma durumu (`status`) ile sonucu (`conclusion`) arasındaki fark.
- Sadece son 30 kayıtla tüm geçmiş hakkında sonuç çıkarılamaması.
- Bir API isteğinin başarısız olmasının neden uygulamanın tamamen boş kalmasını gerektirmediği.
- Örnek modunun gerçek veriyle karışmaması için kullanılan etiket ve durum değişimi.
- `run_attempt` değerinin neden önemli olduğu.
- Süreyi `updated_at` üzerinden tahmin etmek yerine gerçek başlangıç/bitiş alanlarını kullanma nedeni.
- API yanıtındaki bir bağlantıyı doğrudan tıklanabilir hale getirmek yerine güvenilir kökten URL oluşturmanın nedeni.
- İstek iptali ile eski yanıtın yok sayılmasının birlikte kullanılması.
- Önbellek ömrünün her okumada uzamasının neden bayat veri sorununa yol açabileceği.

## İlk kendi geliştirmene öneri

Ayrı bir değişiklik olarak `başarısız sonuçtan sonra aynı dalda başarılı çalıştırma var mı?` göstergesi ekleyebilirsin. Aynı iş akışını, dalı ve tarih sırasını karşılaştır. Son 30 kayıtta düzeltme bulunmaması, düzeltme yapılmadığını kanıtlamaz; gösterge bu sınırı açıklamalı. Mevcut MVP bu otomatik karşılaştırmayı yapmıyor.
