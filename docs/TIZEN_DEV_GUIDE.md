# Samsung Tizen TV Development & Deployment Guide

> **Not:** Bu dokümandaki IP adresleri RFC 5737 dokümantasyon örnekleridir (`192.0.2.93`, `192.0.2.153`). Gerçek yerel ağınızdaki TV ve bilgisayar IP adreslerini kullanın.

## 1. Samsung TV Ağ ve Geliştirici Modu Kurulumu

* **TV Modeli:** Samsung 65QN95B (2022 QLED Neo)
* **Örnek TV IP Adresi:** `192.0.2.93`
* **Örnek Geliştirici Host IP:** `192.0.2.153` (Mac/PC bilgisayarınızın yerel IP'si)

### TV'de Developer Mode Açma
1. TV kumandasından **Smart Hub** $\rightarrow$ **Uygulamalar (Apps)** sekmesine gidin.
2. Kumandadan ardışık olarak `1 - 2 - 3 - 4 - 5` tuşlayın.
3. Açılan modal pencerede **Developer Mode: ON** yapın.
4. **Host PC IP** kısmına geliştirici bilgisayarınızın yerel IP'sini (ör. `192.0.2.153`) yazıp kaydedin.
5. TV'yi kumandanın güç tuşuna uzun basarak (veya fişten çekip takarak) yeniden başlatın.

---

## 2. Neden Apps2Samsung Kullanıyoruz? (Apple Silicon ve Rosetta 2 Kısıtı)

* **Sorun:** Samsung'un resmi Tizen Studio ve standalone SDB araçları x86_64 (Intel) mimarisi için derlenmiştir. Geliştirici bilgisayarı Apple Silicon (`arm64`) olduğunda ve Rosetta 2 yüklü değilse terminalden `sdb` çalıştırıldığında `bad CPU type in executable` hatası verir.
* **Çözüm:** **Apps2Samsung** (Mac M1/M2/M3 yerel arm64 uygulaması).
  * Apps2Samsung, kendi içinde C# tabanlı yerel bir SDB bağlantı yığını ve otomatik Tizen sertifika imzalayıcısı barındırır.
  * Rosetta 2 veya 5 GB'lık Tizen Studio IDE'sine gerek kalmadan doğrudan `.wgt` paketlerini TV'ye gönderir.

---

## 3. Paket Derleme ve Yükleme Adımları

1. Kodda bir değişiklik yaptığınızda repo kökünden `.wgt` paketini derleyin:
   ```bash
   npm run package
   # -> ./dist/olauncher.wgt oluşturulur.
   ```
2. **Apps2Samsung** uygulamasını açın:
   * TV IP'si: kendi TV IP adresiniz (Port `26101` otomatik bağlanır).
   * Dosya seçici ile `./dist/olauncher.wgt` dosyasını seçin.
   * **Install** butonuna tıklayın.
3. Uygulama saniyeler içinde TV ekranında açılır.

---

## 4. Tizen Kumanda Tuş Kodları (KeyCodes)

Tizen 6.5 Web Runtime ortamında kumanda tuşları aşağıdaki DOM `keyCode` değerlerini üretir:

| Tuş | `event.keyCode` | Açıklama |
| :--- | :--- | :--- |
| **Sol Ok (Left)** | `37` | Yatay navigasyon |
| **Yukarı Ok (Up)** | `38` | Dikey navigasyon / Üst bara geçiş |
| **Sağ Ok (Right)** | `39` | Yatay navigasyon |
| **Aşağı Ok (Down)** | `40` | Dikey navigasyon / Alt satıra geçiş |
| **Enter / Tamam** | `13` | Seçim / Uygulama başlatma |
| **Geri (Back)** | `10009` | Tizen donanımsal Return/Back tuşu |
| **Exit** | `10182` | Uygulamadan çıkış |
| **Play / Pause** | `415 / 19` | Medya kontrolleri |

> Geri (Back / Return) ve yön tuşları `launcher/js/input/NavigationManager.js` içinde saf DOM `keydown` olay dinleyicileriyle yönetilir (`tvinputdevice` donanım kilidi kullanılmaz).
