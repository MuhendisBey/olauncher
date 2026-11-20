# Home Assistant & Siri Entegrasyon Kılavuzu

Bu doküman; **Apple Siri** ("Hey Siri, Netflix Aç", "Hey Siri, YouTube Aç", "Hey Siri, İnterneti Aç" vb.) sesli komutlarının **Home Assistant** üzerinden doğrudan Samsung TV'nizdeki **OLauncher**'a nasıl ulaştığını ve nasıl kurulacağını anlatır.

> **Not:** Örneklerdeki `192.0.2.104` adresi RFC 5737 dokümantasyon IP'sidir; kendi Home Assistant sunucunuzun IP adresini ve `config.json` içindeki `device_id` değerini (varsayılan: `living_room_tv`) kullanın.

---

## 1. Mimari Akış (Nasıl Çalışıyor?)

```
+------------------+         +----------------------+         +-----------------------+         +---------------------+
|   Apple Siri     |  ---->  |   Home Assistant     |  ---->  |   OLauncher           |  ---->  |   Samsung Tizen OS  |
|  (iPhone/Mac)    |         | (192.0.2.104:8123)   |         | (WebSocket İstemcisi) |         | (Uygulama Yöneticisi|
| "Netflix Aç"     |         | tizen_tv_action olayı|         | "Siri: Netflix..."    |         |  Netflix Başlatıldı |
+------------------+         +----------------------+         +-----------------------+         +---------------------+
```

1. Siz Siri'ye **"Netflix Aç"** dediğinizde Apple Kestirmeler (veya HomeKit), Home Assistant'a bir istek gönderir.
2. Home Assistant, `tizen_tv_action` adında yerel bir WebSocket olayı yayınlar (`action: "netflix", target: "living_room_tv"`).
3. TV ekranında açık olan OLauncher, kalıcı WebSocket bağlantısından bu olayı anında yakalar.
4. Ekranda şık bir **"Siri: Netflix Açılıyor..."** toast bildirimi gösterilir ve TV'deki Netflix (`org.tizen.netflix-app`) doğrudan tam ekran başlatılır.

---

## 2. Desteklenen Sesli Komutlar ve Eylemler

| Siri Komutu | HA `action` Değeri | Yapılan İşlem |
| :--- | :--- | :--- |
| **"Netflix Aç"** | `netflix` | Netflix (`org.tizen.netflix-app`) başlatılır. |
| **"YouTube Aç"** | `youtube` | YouTube (`9Ur5IzDKqV.TizenYouTube`) başlatılır. |
| **"İnterneti Aç"** / "Tarayıcıyı Aç" | `browser` (veya `internet`) | Samsung Web Tarayıcı (`org.tizen.browser`) başlatılır. |
| **"Stremio Aç"** | `stremio` | Stremio başlatılır. |
| **"Spotify Aç"** | `spotify` | Spotify (`rJeHak5zRg.Spotify`) başlatılır. |
| **"XBOX'a Geç"** | `xbox` | TV otomatik olarak HDMI 2 (XBOX) girişine geçer. |
| **"Disney Aç"** | `disney` | Disney+ (`MCmYXNxgcu.DisneyPlus`) başlatılır. |
| **"Prime Video Aç"** | `prime` | Prime Video (`org.tizen.primevideo`) başlatılır. |
| **"Ana Ekrana Dön"** | `home` | Varsa açık modallar kapatılır, OLauncher ana ekranına dönülür. |
| **"Smart Hub'ı Aç"** | `smarthub` | Orijinal Samsung Smart Hub arayüzü açılır. |
| **"Durdur / Oynat"** | `play_pause` | Oynatma durumu değiştirilir. |

---

## 3. Kurulum Yöntemi 1: Apple Kestirmeler (Shortcuts) ile (En Hızlısı — 1 Dakika)

Bu yöntem Home Assistant iOS uygulaması yüklü olan iPhone, iPad veya Mac'inizde **30 saniyede** çalışır:

1. iPhone'unuzda **Kestirmeler (Shortcuts)** uygulamasını açın.
2. Sağ üstteki **+** simgesine dokunun.
3. Kestirmenin adını (en üstte) tam olarak söylemek istediğiniz cümle yapın:
   * Örneğin: **Netflix Aç**
4. **İşlem Ekle (Add Action)** butonuna basın ve arama çubuğuna **Home Assistant** yazın.
5. Listeden **Olayı Tetikle (Fire Event)** seçin:
   * **Event:** `tizen_tv_action`
   * **Event Data:** `{"action": "netflix", "target": "living_room_tv"}`
6. **Bitti (Done)** deyin.

---

## 4. Kurulum Yöntemi 2: Home Assistant Scriptleri ile (HomeKit & Tüm Cihazlar)

### 4.1. Otomatik Script Yükleme (`deploy_ha_scripts.py`)
Aşağıdaki ortam değişkenlerini vererek scriptleri tek komutta Home Assistant'a yükleyebilirsiniz:

```bash
export HA_URL="http://192.0.2.104:8123"
export HA_TOKEN="YOUR_LONG_LIVED_ACCESS_TOKEN_HERE"
export TV_DEVICE_ID="living_room_tv"
export TV_MEDIA_PLAYER_ENTITY="media_player.living_room_tv"
export TV_SOURCE_SELECT_ENTITY="input_select.living_room_tv_source"

npm run ha:deploy-scripts
```

### 4.2. Manuel `scripts.yaml` Örneği
Home Assistant'ınızdaki `scripts.yaml` dosyanıza şu blokları ekleyebilirsiniz:

```yaml
# ==============================================================================
# OLauncher Samsung TV Siri / Home Assistant Sesli Komut Scriptleri
# ==============================================================================

tv_netflix_ac:
  alias: "Netflix Aç"
  icon: "mdi:netflix"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: netflix
        target: living_room_tv

tv_youtube_ac:
  alias: "YouTube Aç"
  icon: "mdi:youtube"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: youtube
        target: living_room_tv

tv_interneti_ac:
  alias: "İnterneti Aç"
  icon: "mdi:web"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: browser
        target: living_room_tv

tv_stremio_ac:
  alias: "Stremio Aç"
  icon: "mdi:play-circle"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: stremio
        target: living_room_tv

tv_spotify_ac:
  alias: "Spotify Aç"
  icon: "mdi:spotify"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: spotify
        target: living_room_tv

tv_xbox_gec:
  alias: "XBOX'a Geç"
  icon: "mdi:microsoft-xbox"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: xbox
        target: living_room_tv

tv_durdur_oynat:
  alias: "TV Durdur Oynat"
  icon: "mdi:play-pause"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: play_pause
        target: living_room_tv

tv_ana_ekran:
  alias: "TV Ana Ekran"
  icon: "mdi:home"
  sequence:
    - event: tizen_tv_action
      event_data:
        action: home
        target: living_room_tv
```

### HomeKit Köprüsü ile Apple Ev Uygulamasına Ekleme
1. Home Assistant arayüzünde: **Ayarlar $\rightarrow$ Cihazlar ve Hizmetler $\rightarrow$ HomeKit Bridge (Köprü)** bölümüne gidin.
2. Dahil Edilecekler (Include) listesinden **Komut Dosyaları (Scripts)** seçeneğini işaretleyin.
3. Apple iPhone'unuzdaki **Ev (Home)** uygulamasında *"Netflix Aç"*, *"YouTube Aç"* sahneleri belirecektir.

---

## 5. Terminalden Test Etme

Kurulumu test etmek için ortam değişkenlerini tanımlayıp `ha_remote_ctl.py` aracını çalıştırabilirsiniz:

```bash
export HA_URL="http://192.0.2.104:8123"
export HA_TOKEN="YOUR_LONG_LIVED_ACCESS_TOKEN_HERE"
export TV_DEVICE_ID="living_room_tv"

python3 tools/ha_remote_ctl.py netflix
python3 tools/ha_remote_ctl.py youtube
python3 tools/ha_remote_ctl.py browser
python3 tools/ha_remote_ctl.py stremio
python3 tools/ha_remote_ctl.py xbox
```
