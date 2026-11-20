# OLauncher (Samsung 65QN95B / Tizen 6.5)

Samsung 65QN95B (2022 model, Tizen 6.5, ARMv7, Chromium 85 tabanlı Web Engine) televizyon için geliştirilmiş, reklam ve gecikme dolu varsayılan Samsung Smart Hub arayüzüne hafif bir alternatif sunan **Özel 4K Minimalist TV Launcher (.wgt)** ve eşlik eden **Native C++ Sistem Kurtarma Araçları (.tpk / CLI)**.

> [!WARNING]
> **Güvenlik ve Sorumluluk Reddi (Disclaimer):**
> Bu projedeki C++ araçları (`native/tools/olauncher_native_ctl.cpp`, `native/rescue_app/`), Samsung TV'nin dahili `vconf` (`db/appfw/home_appid`) ve AUL ayarlarını değiştirerek varsayılan Home başlatıcısını yeniden eşler. Farklı Tizen sürümlerinde veya model ailelerinde beklenmeyen davranışlar oluşabilir. Kullanım tamamen kendi sorumluluğunuzdadır; uygulamadan önce her zaman mevcut sistem değerlerinizi yedekleyin (`query`) ve kurtarma yolunu hazır tutun.

---

## 📸 Canlı Görünüm & Tasarım

Arayüz doğrudan `3840x2160` yerel 4K çözünürlük için tasarlanmıştır (Tizen Web Engine'in `1920x1080` mantıksal CSS uzayına `fitStage()` ile otomatik ölçeklenir).

* **Sol Üst:** Büyük saat, Türkçe tarih ve günün saatine göre değişen sıcak karşılama (`ClockHeader`).
* **Sağ Üst:** Home Assistant ev otomasyonu telemetrisi (`TelemetryHeader`, ör. `Salon: 22.4°C`) ve cam görünümlü İngiliz Anahtarı (🔧) kurtarma menüsü butonu.
* **Orta Alan:** Arka plan duvar kâğıdının veya aile portresinin kapanmaması için ferah ve açık bırakılmıştır.
* **Alt Alan (Sabit 7 Kart Kuralı):** Yatay taşmayı önlemek için ana şeritte tam **7** kart yer alır: `Web Tarayıcı`, `XBOX (HDMI 2)`, `Stremio`, `Spotify`, `YouTube`, `Netflix` ve `DİĞER UYGULAMALAR` (4 sütunlu 2D ızgara modalı).
* **Alt Bilgi Çubuğu:** Home Assistant canlı bağlantı durumu (yeşil/kırmızı nokta) ve sürüm bilgisi.

---

## 🏗️ Mimari ve Tasarım Desenleri

* **Adapter / Bridge Pattern:** `ITizenBridge` arayüzü sayesinde uygulama kodları Tizen API'lerine doğrudan bağımlı değildir. Bilgisayarda `BrowserMockBridge`, TV üzerinde `TizenNativeBridge` çalışır.
* **Observer / Pub-Sub Pattern:** `EventBus` ve `HomeAssistantClient` üzerinden gelen sıcaklık, hava durumu ve uzaktan komutlar UI bileşenlerine gevşek bağlı (loosely coupled) iletilir.
* **State & Command Pattern:** `NavigationManager` ile 10-foot TV kumanda navigasyonu (Yukarı, Aşağı, Sol, Sağ, Enter, Back) ve modal odak yakalama yönetilir.
* **Factory & Strategy Pattern:** `AppCardFactory` ile tüm HDMI ve uygulama kartları doğru marka renkleri ve vektör SVG'lerle üretilir.
* **Zero-Overhead Glassmorphism (60 FPS):** Canlı `backdrop-filter: blur()` kullanılmamıştır; tüm animasyonlar GPU donanım hızlandırmalı (`transform: translate3d`, `scale`, `opacity`) çalışır.
* **Multitasking & HDR10+ İzolasyonu:** `Window.blur()` ile temiz odak devri (tam ekran tarayıcı imleç bug'ını önler), `multitasking.support="true"` ile 0ms geri dönüş ve modal kapsayıcı izolasyonuyla HDR10+ sonrası 1024px karo yırtılması koruması uygulanır.

Detaylı mimari dokümantasyon için: [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) • [docs/architectural_decisions.md](./docs/architectural_decisions.md)

---

## 🛡️ 3 Katmanlı Güvenlik Ağı

1. **Inline Crash-Loop Watchdog:** `launcher/index.html` başında çalışır. 15 saniyede 3 çökme yaşanırsa otomatik olarak Samsung Smart Hub'ı (`com.samsung.tv.csfs`) açar.
2. **C++ Home-Button Kontrol Aracı:** `native/tools/olauncher_native_ctl.cpp`, 32-bit ARM ve SDK UID 901 doğrulamasıyla `db/appfw/home_appid` değerini okur, uygular ve hata durumunda anında geri alır.
3. **Bağımsız C++ Rescue Servisi:** `native/rescue_app/`, tetiklendiğinde Smart Hub ayarını kalıcı olarak eski haline getirir ve Smart Hub'ı başlatır.

---

## 🚀 Yerel Geliştirme ve Önizleme

Hiçbir TV bağlantısı gerektirmeden bilgisayarınızda test edebilirsiniz:

```bash
# 1. Bağımlılıkları yükleyin
npm install

# 2. (Opsiyonel) Kişisel yapılandırma şablonunu kopyalayın (gitignored)
cp launcher/config.example.json launcher/config.json

# 3. Geliştirme sunucusunu ve Sahte Home Assistant sunucusunu başlatın
npm run dev
```

* Tarayıcınızda açın: **`http://127.0.0.1:8080`**
* **Kumanda Navigasyonu:** Klavyenizin **Ok Tuşları** ile gezinin, **Enter** ile açın, **Esc** veya **Backspace** ile geri çıkın.
* Sağ üstteki 🔧 ikonuna tıklayarak veya odaklanıp Enter'a basarak Kurtarma Menüsünü test edebilirsiniz.
* Test ve hijyen denetimi:
  ```bash
  npm test
  npm run hygiene
  ```

---

## 🖼️ Kendi Duvar Kâğıdınızı Eklemek

Varsayılan açık kaynak sürüm `launcher/assets/wallpapers/default-wallpaper.svg` dosyasını kullanır. Kendi fotoğrafınızı eklemek için:

1. **Özellikler:** `3840 x 2160` piksel (veya 16:9 oranında), `.jpg` veya `.png`.
2. **Dosya Konumu:**
   * Kişisel görselinizi `launcher/assets/wallpapers/wallpaper.local.png` (veya `*.local.*`) olarak kaydedin (bu dosyalar `.gitignore` tarafından otomatik olarak dışlanır).
   * `launcher/config.json` içindeki `display.wallpaper` alanını `"assets/wallpapers/wallpaper.local.png"` şeklinde güncelleyin.

---

## 🏠 Home Assistant Yapılandırması

Gerçek Home Assistant sunucunuza bağlanmak için gitignored `launcher/config.json` dosyasını düzenleyin:

```json
{
  "home_assistant": {
    "enabled": true,
    "ha_url": "ws://192.0.2.104:8123/api/websocket",
    "access_token": "YOUR_LONG_LIVED_ACCESS_TOKEN_HERE",
    "entities": {
      "temperature": "sensor.living_room_temperature",
      "weather": "weather.home"
    },
    "temperature_label": "Salon",
    "device_id": "living_room_tv",
    "source_select_entity": "input_select.living_room_tv_source"
  }
}
```

Siri ve Home Assistant otomasyon scriptlerini yüklemek için bkz. [docs/HOME_ASSISTANT_SIRI.md](./docs/HOME_ASSISTANT_SIRI.md).

---

## 📦 Paketleme ve TV Kurulumu (.wgt)

```bash
# 1. Tizen için optimize edilmiş paketi derleyin ve .wgt arşivini oluşturun
npm run package
# -> dist/olauncher.wgt oluşturulur (launcher/config.json yoksa config.example.json paketlenir).

# 2. TV'ye kurun (Developer Mode açıkken; 192.0.2.93 yerine kendi TV IP'nizi yazın)
./native/scripts/sdb-setup.sh 192.0.2.93 install-wgt

# 3. Home Tuşunu OLauncher'a yönlendirin (Opsiyonel)
./native/scripts/sdb-setup.sh 192.0.2.93 apply
```

Detaylı Sideloading ve Apple Silicon (`Apps2Samsung`) adımları için: [docs/TIZEN_DEV_GUIDE.md](./docs/TIZEN_DEV_GUIDE.md).

---

## 📄 Lisans

Bu proje [MIT Lisansı](./LICENSE) altında açık kaynak olarak sunulmaktadır.
