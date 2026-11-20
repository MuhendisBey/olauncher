# Samsung Tizen TV (QN95B / PontusM) — Tam Ekran İmleç Kök Neden Analizi

Bu doküman, Samsung 65QN95B (Tizen 6.5, SoC: PontusM ARMv7 32-bit, Chromium 85) üzerinde Web Tarayıcı tam ekran video oynatırken ortaya çıkan **27-30 saniye sonra imlecin kendiliğinden belirmesi** hatasının teknik kök neden bulgularını özetler.

> **Not:** Telif hakkı ve cihaz mahremiyeti nedeniyle tescilli Samsung binary disassembly çıktıları ile canlı TV süreç günlükleri public depoya dahil edilmemiştir; yalnızca teknik analiz özeti ve çözüm mimarisi paylaşılmaktadır.

---

## Temel Bulgular Özeti

1. **İmlecin Merkeze Işınlanması (`cursormgr_module.so` `0x3424`):**
   * Enlightenment Tizen pencere yöneticisi, imleç tam ekran videoda gizlendiğinde dahili bir bayrak tutar (`[r5, #0x74] = 1`).
   * Herhangi bir harici giriş veya yetim odak olayı geldiğinde `0x3424` fonksiyonu çağrılarak `e_input_device_pointer_warp` çalıştırılır ve imleç zorla ekranın ortasına (`1920, 1080`) getirilip görünür yapılır.
2. **30 Saniyelik Boşta Kalma Sayacı (`browser.elf` `0x3ccbd8`):**
   * `BrowserInputManager::InputManager::timerIdle` fonksiyonu 5 saniyede bir boşta kalma süresini artırır.
   * `r1 == 30` olduğunda (`cmp r1, #30`) bir Boost sinyali ateşlenir.
3. **Home Assistant `remote-server` Polling:**
   * Yerel ağdaki Home Assistant (`192.0.2.104` örneği), TV'nin port `8001`/`8002` üzerindeki `remote-server` (`/dev/uinput` sanal fare yöneticisi) servisini periyodik olarak ~30 saniyede bir sorgular.
   * Uygulama başlatılırken pencere odağı temizlenmemişse (`Invalid client in FocusIn event`), bu sorgulama sanal fare aygıtını uyandırarak `0x3424` ışınlama fonksiyonunu tetikler.

---

## Kalıcı Çözüm

`launcher/js/platform/TizenNativeBridge.js` içinde harici uygulama başlatılmadan hemen önce `window.blur()` ve `document.activeElement.blur()` çağrılarak pencere odağı Enlightenment compositor'ına temiz biçimde devredilir; eşzamanlı olarak `HomeAssistantClient` soketi kapatılır ve kuyruk temizlenir. Bu yaklaşım TV'nin global `pointing_available` vconf ayarını bozmadan (masaüstü modunda imleç işlevini koruyarak) tam ekran video sırasında imleç sıçramasını tamamen ortadan kaldırır.
