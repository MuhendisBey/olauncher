# Samsung TV OLauncher — Agent & Developer Handbook (`AGENTS.md`)

> **ÖNEMLİ KURAL (Absolute Transparency):**  
> Bu projede kullanıcıya haber vermeden, şeffaf bir şekilde neyin yapıldığını açıklamadan hiçbir arka plan kurulumu veya riskli sistem komutu çalıştırılamaz. Her işlem açık ve anlaşılır olmalıdır.

---

## 1. Proje Amacı ve Özeti

**OLauncher (`OLauncher1.OLauncher`)**, Samsung'un varsayılan reklam ve gecikme dolu Smart Hub arayüzünün yerini almak üzere geliştirilmiş; **4K Ultra Minimalist, 60 FPS Sıfır Gecikmeli TV Launcher** ve C++ Donanımsal Kurtarma aracıdır.

* **Geliştirici / Sahip:** `muhendisbey` (Gürsoy Ailesi)
* **Paket Adı:** `OLauncher1`
* **Uygulama ID:** `OLauncher1.OLauncher`
* **Lisans / Telif:** MIT License — Gürsoy ©

---

## 2. Hedef Donanım ve Platform Kısıtları

| Özellik | Değer | Açıklama |
| :--- | :--- | :--- |
| **TV Modeli** | **Samsung 65QN95B (2022)** | Model Kodu: `QE65QN95BATXTK` |
| **Platform / SoC** | `22_PONTUSM_QTV` | ARMv7 32-bit SoC, Mali-G52 GPU |
| **İşletim Sistemi** | **Tizen 6.5** | Linux çekirdeği tabanlı |
| **Web Motoru** | **Chromium 85** | Tizen Web Runtime |
| **Örnek TV IP Adresi** | `192.0.2.93` *(RFC 5737 yer tutucu)* | Yerel cihaz IP'si `config.json` / private ops içinde tutulur |
| **SDB Portu** | `26101` | Geliştirici Modu (`Developer Mode: 1`, örnek Host IP: `192.0.2.153`) |
| **Geliştirici Makinesi** | Apple Silicon (`arm64` macOS) | Rosetta 2 **yüklü değil**; x86_64 Tizen Studio binary'leri çalışmaz |
| **Home Assistant** | `ws://192.0.2.104:8123/api/websocket` *(örnek)* | Token ile WebSocket API üzerinden canlı telemetri |

---

## 3. Temel Mimari Kararlar ve Teknik Kısıtlar

### 3.1. 1080p CSS Koordinat Uzayı ve `fitStage` Otomatik Ölçekleme
* **Problem:** Samsung Tizen TV'lerde panel fiziksel olarak 4K (3840x2160) olsa bile, Tizen Web Engine (Chromium 85) arayüzü **1920x1080 CSS mantıksal piksel** koordinatında çalıştırır. Eğer 3840x2160 sahne doğrudan render edilirse, ekran %200 zoom yapar ve üst bar ile alt menü ekran dışına taşar.
* **Çözüm:** `launcher/index.html` içine gömülen inline `fitStage()` scripti:
  $$\text{scale} = \min\left(\frac{\text{window.innerWidth}}{3840}, \frac{\text{window.innerHeight}}{2160}\right)$$
  TV'de $\text{scale} = 0.5$ uygulanarak 3840x2160 sahne 1080p ekrana milimetrik oturtulur. `window.scrollTo(0, 0)` ile kilitlenerek ekran kayması engellenir.

### 3.2. Sıfır Ek Yüklü Prizmatik Cam Efekti (Zero-Overhead Glassmorphism)
* **Problem:** Standart CSS `backdrop-filter: blur(20px)` efekti, TV'nin mobil GPU'sunu (Mali-G52) 4K/1080p dokuyu her karede geri okumaya ve Gauss bulanıklığı hesaplamaya zorlar. TV'de kare hızını 60 FPS'den 15-20 FPS'ye düşürür.
* **Çözüm:** Blur kullanılmaz! Gerçek kristal cam görünümü GPU-kompozit CSS donanım primitive'leri ile sağlanır:
  1. Opak renkler yerine **yarı saydam füme/renkli cam gradyanları** (`rgba(..., 0.58)` $\rightarrow$ `rgba(..., 0.85)`). Duvar kağıdı arkadan süzülür.
  2. Üst kenar 2px prizmatik ışık çizgisi (`.app-card::after`).
  3. 140° çapraz fiziksel cam yansıması (`.app-card::before`).
  4. Çift katmanlı iç kenar ışığı (`box-shadow: inset 0 2px 2px rgba(255,255,255,0.55)`).
  5. Seçildiğinde (focus) lüminesans beyaz cam aurası (`scale(1.06)`).
  * **Sonuç:** GPU'ya sıfır ek yük, kilitli **60.0 FPS** kaydırma hızı!

### 3.3. Ekrana Sabit 7 Kart Kuralı ve Sayfa Kayması Koruması
* **Problem:** Kartlar büyütüldüğünde 8 veya daha fazla kart 3840px ekran genişliğini taşar. En sağdaki karta gelindiğinde tarayıcı kutuyu göstermek için ekranı sola kaydırır ve sağ tarafta siyah boşluk açılır.
* **Çözüm:**
  * Ana ekranda kart sayısı tam **7 adede** sabitlenmiştir:
    1. **Web Tarayıcı** (En çok kullanılan uygulama olarak en başta)
    2. **XBOX** (HDMI 2 Girişi)
    3. **Stremio** (Özel mor prizmatik cam kart)
    4. **Spotify** (Zümrüt yeşili cam kart)
    5. **YouTube**
    6. **Netflix**
    7. **DİĞER UYGULAMALAR** (Disney+, Prime Video, Apple TV vb. tüm yüklü uygulamalar)
  * Boyutlar: Kart genişliği `470px`, Boşluk `45px`.  
    $(7 \times 470) + (6 \times 45) = 3560\text{px}$. Sağ/sol 140px boşluklarla birlikte toplam tam $3840\text{px}$.
  * `NavigationManager`'da saf CSS `.is-focused` odak yönetimi kullanılır; yerel sayfa kayması tamamen kilitlenmiştir.

### 3.4. Tizen Sistem Servislerinin Filtrelenmesi (71 Uygulama Problemi)
* **Problem:** Tizen'in `tizen.application.getAppsInfo()` fonksiyonu televizyondaki tüm dahili arka plan servislerini (SmartThings, CSFS, Dial, AirPlay, Miracast, RetailMode, DeviceAuth, Setting vb. 50+ servis) `show: true` olarak döner.
* **Çözüm:**
  * `ALLOWED_SYSTEM_APPS` beyaz listesi tanımlandı:
    * `org.tizen.browser` (Web Tarayıcı)
    * `org.tizen.netflix-app` (Netflix)
    * `org.tizen.primevideo` (Prime Video)
    * `com.samsung.tv.aria-video` (Apple TV)
    * `org.tizen.gallery` (Galeri)
  * `com.samsung.*` veya `org.tizen.*` ile başlayan tüm diğer servisler otomatik elenir.
  * Harici indirilen tüm tüketici uygulamaları (Disney+, YouTube, Spotify, Twitch vb.) listede tutulur ve alfabetik sıralanır.
  * Tizen sisteminden gelen resmi uygulama ikonları (`a.iconPath`) ekranda gösterilir.

### 3.5. 2D Izgara Navigasyonu ve Dikey Slider
* **AllAppsModal:** 4 sütunlu ızgara yapısında çalışır.
* **Kumanda Ok Tuşları:**
  * `Aşağı (Down)`: Tam 4 sıra sonrasına (altındaki kutuya) iner. En alttaysa "Kapat" butonuna geçer.
  * `Yukarı (Up)`: Tam 4 sıra öncesine (üstündeki kutuya) çıkar.
  * `Sağ / Sol`: Sırayla birer kutu ilerler.
* **Slider ve Konum:** Sağ tarafta dikey kaydırma çubuğu ve sağ üstte canlı `X / Y Uygulama` göstergesi bulunur.

### 3.6. Home Assistant Entegrasyonu
* Bağlantı: `launcher/js/ha/HomeAssistantClient.js` üzerinden kalıcı WebSocket (`ws://...`).
* Sıcaklık: Hem `sensor.*` hem `climate.*` (`attributes.current_temperature`) entiteleri desteklenir (ör. `sensor.living_room_temperature` veya `climate.living_room`).
* Hava Durumu: `weather.*` entitesinden ikon ve durum bilgisi alınır (`weather.home` vb.).

### 3.7. Çift Çalışma Modu (Dual-Mode Architecture)
* **Desktop Preview Modu:** Bilgisayarda tarayıcıda (`http://127.0.0.1:8080/`) `BrowserMockBridge` çalışır. TV olmadan tüm görsel ve kumanda navigasyon testleri yapılır.
* **Real TV Modu:** TV'ye yüklendiğinde `TizenNativeBridge` devreye girer; `window.tizen.application` ve `window.tizen.systeminfo` API'lerini kullanır.

### 3.8. Güvenlik ve Kurtarma (Safety Nets)
1. **Katman 1 (Inline Watchdog):** `launcher/index.html` başında inline JavaScript çalışır. 15 saniye içinde 3 kez hata/çökme yaşanırsa OLauncher otomatik olarak Samsung Smart Hub (`com.samsung.tv.csfs`) veya Home (`com.samsung.tv.home`) uygulamasına döner.
2. **Katman 2 (Kurtarma Modalı):** Sağ üstteki İngiliz Anahtarı (Wrench) butonuna tıklandığında "Samsung Smart Hub'a Dön" ve "Kurtarma Aracını Başlat" seçenekleri sunulur.
3. **Katman 3 (Donanımsal Baseline):** TV'nin orijinal Home ID'si gitignored `home-baseline.json` içinde (ve şifreli ops deposunda) güvendedir.

### 3.9. Samsung Web Tarayıcı Tam Ekran İmleç ve Odak Devri Mimarisi (27-30s Kök Neden & Çözüm)
* **Problem:** OLauncher'dan Samsung Web Tarayıcısı (`org.tizen.browser`) başlatıldığında, tam ekran video veya film izlerken kumandaya hiç dokunulmasa bile imleç ~5. saniyede kaybolmakta; ancak tam **27-30 saniye sonra kendiliğinden ekranın tam ortasında belirmekteydi**.
* **Kök Neden Özeti (`docs/disassembly/README.md`):**
  1. **Enlightenment Pencere Yöneticisi (`cursormgr_module.so`):** İmleç tam ekran videoda gizlendiğinde dahili bayrağı (`[r5, #0x74] = 1`) aktif eder. Ancak `0x3424` ("Warp cursor to center") fonksiyonu, odak değişimi veya harici uinput girdisi geldiğinde `e_input_device_pointer_warp` ile imleci zorla ekranın ortasına (`1920, 1080`) ışınlar.
  2. **Tarayıcı Boşta Kalma Sayacı (`browser.elf`):** `BrowserInputManager::InputManager::timerIdle` (`0x3ccb90`) her 5 saniyede bir boşta kalma sayacını artırır; sayaç 30'a ulaştığında (`cmp r1, #30` @ `0x3ccbd8`) Boost/Wake sinyali gönderir.
  3. **Tizen Katman Önceliği:** Pencere odağı temizce serbest bırakılmadığında Enlightenment compositor'ı `Invalid client in FocusIn event, Cursor behaviour can be abnormal` uyarısı üretir ve imleci "warp-ready" modda bırakır.
  4. **Home Assistant `remote-server` Tetikleyicisi:** Yerel ağdaki Home Assistant, TV'nin port 8001/8002'deki `remote-server` servisini (`/dev/uinput` sanal fare sürücüsü) periyodik olarak ~27-30 saniyede bir sorgulayarak uinput üzerinden ışınlamayı tetikler.
* **Kalıcı Çözüm (Zero-Side-Effect Clean Window Blur):**
  * `launcher/js/platform/TizenNativeBridge.js` içinde `launchApp` çağrılmadan hemen önce:
    ```javascript
    if (typeof window.blur === 'function') window.blur();
    if (document.activeElement && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }
    ```
    ile pencere ve DOM odakları temiz bir şekilde serbest bırakılır.
  * `launcher/js/main.js` içinde uygulama geçişinde `_suspendActivity(true)` çağrılarak DOM temizliği senkronize edilir.
  * `launcher/js/ha/HomeAssistantClient.js` içinde bağlantı kapatılırken bekleyen log kuyruğu sıfırlanır (`this._logQueue = []`).
* **KESİNLİKLE YASAKLANAN YAN ETKİLİ YÖNTEMLER (CRITICAL WARNING):**
  * TV'nin global `db/menu/pointing_available` veya benzeri `vconf` fare ayarını kalıcı olarak `false` yapmak **KESİNLİKLE YASAKTIR**. Bu anahtar kapatılırsa, kullanıcının Samsung Web Tarayıcısı'nda masaüstü modunda gezinirken kumanda ile imleç kullanması tamamen bozulur.

### 3.10. Çoklu Görev (Multitasking), Anında Geri Dönüş ve Pürüzsüz Katman Devri Mimarisi (v1.12.1+)
* **Problem 1 (Soğuk Başlatma Gecikmesi):** Launcher süreçten atılırsa (`multitasking.support="false"`), `Home` / `Back` dönüşlerinde "OLauncher yükleniyor..." açılış ekranı çıkar.
* **Problem 2 (Z-Stack Flash):** `tizen.application.launch()` geri çağrımında erkenden `currentApp.hide()` çağrılırsa, hedef ağır uygulama (~800ms) penceresini çizene kadar OLauncher'ın altındaki önceki uygulama (ör. YouTube) anlık ekranda belirir.
* **Çözüm:**
  1. `config.xml` manifestinde `multitasking.support="true"` ve `homereturnsupport="true"` tanımlıdır.
  2. Uygulama başlatılırken önce temiz focus handoff + `_suspendActivity(true)` çalışır, **erken `hide()` ÇAĞRILMAZ**.
  3. Hedef uygulama ekranı kaplayınca doğal `visibilitychange` (`document.hidden === true`) ile arka planda uyku moduna geçilir.
  4. Kullanıcı `Home` / `Back` tuşuna bastığında OLauncher RAM'den **0ms'de anında** uyanır (`_resumeActivity()`).

### 3.11. HDR10+ Ekran Mod Değişimi, 1024px Karo Hasar Yırtılması ve Dinamik Donanım Katmanı İzolasyonu (v1.12.3+)
* **Problem:** HDR10+ içerikten 8-bit SDR launcher yüzeyine dönülürken Mali-G52 TBDR $X=1024\text{px}$ karo sınırında modal butonları ikiye bölünebiliyordu.
* **Çözüm:**
  1. `.modal-dialog` kapsayıcısına `contain: paint; isolation: isolate; transform: translate3d(0, 0, 0); backface-visibility: hidden;` uygulanmıştır.
  2. **Dinamik Odak Katmanı ($N=1$):** Yalnızca aktif odaklanan öğeye (`.is-focused`) 3D donanım terfisi verilir.
  3. **Uyanış Yüzey Yenilemesi:** `_resumeActivity()` içinde tek karelik `_rehydrateGpuSurface()` tetiklenir.

---

## 4. Dizin ve Dosya Haritası

```
olauncher/
├── AGENTS.md                           # Bu doküman (Public-safe geliştirici el kitabı)
├── LICENSE                             # MIT Lisansı
├── package.json                        # Proje metadata, test/hygiene/build scriptleri
├── .github/workflows/ci.yml            # CI: hygiene, tests ve WGT paket doğrulaması
├── .vscode/tasks.json                  # VS Code / Antigravity görev koşucusu
├── docs/
│   ├── ARCHITECTURE.md                 # Detaylı yazılım mimarisi
│   ├── architectural_decisions.md      # ADR-001+ karar kayıtları
│   ├── HOME_ASSISTANT_SIRI.md          # Siri & Home Assistant sesli komut rehberi
│   ├── TIZEN_DEV_GUIDE.md              # Tizen ve Apps2Samsung sideloading rehberi
│   └── disassembly/README.md           # İmleç hatası kök neden analizi özeti
├── tools/
│   ├── build.mjs                       # WGT esbuild paketleme ve bundle oluşturucu
│   ├── bump-version.mjs                # SemVer senkronizasyon aracı
│   ├── deploy_ha_scripts.py            # Env tabanlı HA script yükleyici (HA_URL, HA_TOKEN)
│   ├── dev-server.mjs                  # 127.0.0.1 yerel simülatör sunucusu
│   ├── ha_remote_ctl.py                # Env tabanlı HA uzaktan eylem tetikleyici
│   ├── hygiene-check.mjs               # Sır, LAN IP ve kişisel dosya sızıntısı denetçisi
│   ├── mock-ha-server.mjs              # 127.0.0.1 sahte HA WebSocket sunucusu
│   ├── package-wgt.sh                  # .wgt zip arşivleyici
│   └── test.mjs                        # Otomatik mimari, sentaks ve güvenlik test paketi
├── launcher/
│   ├── index.html                      # Giriş noktası, watchdog ve fitStage ölçekleme
│   ├── config.xml                      # Tizen manifest (ID: OLauncher1.OLauncher)
│   ├── config.example.json             # Public-safe örnek yapılandırma şablonu
│   ├── icon.png                        # 512x512 OLauncher TV uygulama ikonu
│   ├── css/style.css                   # 4K prizmatik cam stilleri ve HDR10+ izolasyonu
│   ├── assets/
│   │   ├── fonts/Outfit-Variable.ttf   # Çevrimdışı gömülü TV fontu
│   │   └── wallpapers/default-wallpaper.svg # 4K ambient placeholder duvar kâğıdı
│   └── js/                             # Vanilla ES6 modülleri
└── native/
    ├── tools/olauncher_native_ctl.cpp  # Samsung TV Home remap/restore C++ aracı
    ├── rescue_app/                     # Bağımsız C++ Smart Hub kurtarma servisi
    └── scripts/sdb-setup.sh            # SDB ağ bağlantı ve kontrol betiği
```

*(Kişisel sırlar, SOPS/age anahtarları, aile portresi duvar kâğıdı, TV baseline DUID/MAC bilgisi ve SDB komut araçları kardeş **`../samsungTVOlauncher-ops/`** private deposunda tutulur.)*

---

## 5. Komutlar, Paketleme ve Doğrulama İş Akışı

| Komut | Açıklama |
| :--- | :--- |
| `npm start` | `http://127.0.0.1:8080` adresinde mock HA ile yerel simülatörü başlatır. |
| `npm test` | Config, manifest, 7-kart kuralı, JS sentaksı ve güvenlik testlerini koşar. |
| `npm run hygiene` | Git tarafından izlenen tüm dosyalarda sır, LAN IP ve kişisel dosya sızıntısı kontrolü yapar. |
| `npm run package` | Kaynak kodları derler ve `dist/olauncher.wgt` paketini üretir. |
| `npm run version:minor` / `patch` | `package.json`, `config.xml` ve `Version.js` sürümlerini senkronize atlatır. |

---

## 6. Geliştiriciler / AI Ajanları İçin Zorunlu Kurallar

* **HER SÜRÜMDE VERSİYON ATLATMA KURALI:** `package.json`, `launcher/config.xml` ve `launcher/js/core/Version.js` daima senkronize tutulur.
* **Yeni Paket/Bağımlılık Eklemeyin:** Web uygulaması saf Vanilla JS (ES6 modülleri) ve Vanilla CSS ile yazılmıştır.
* **LOGLARDA HASSAS VERİ GÜVENLİĞİ (ZERO-LEAK):** `Logger.js` içindeki `redactSensitive()` filtresi tüm JWT/Bearer/token girdilerini maskeler; `HomeAssistantClient` bağlantı logları asla WebSocket'e geri gönderilmez.
* **Sıfır Gerçek Sır / LAN IP Kuralı:** Public repoda asla gerçek token, RFC 1918 yerel ağ IP'si, kişisel duvar kâğıdı dosyası veya macOS kullanıcı yolu bulunamaz. Her değişiklikten sonra `npm run hygiene` çalıştırılmalıdır.
* **SAMSUNG WEB TARAYICI ODAK DEVRİ & NO EARLY HIDE:** `TizenNativeBridge.launchApp` pencere odağını `blur()` ile serbest bırakır, erken `hide()` çağırmaz ve `pointing_available` vconf anahtarını asla değiştirmez.
