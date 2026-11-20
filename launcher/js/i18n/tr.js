/**
 * Turkish (tr-TR) locale pack.
 *
 * All user-visible strings live here, so components never embed text.
 * Month/weekday names are bundled instead of relying on `Intl` because the
 * TV's ICU data set is not guaranteed to include full Turkish calendar data.
 */
export const tr = Object.freeze({
  code: 'tr-TR',
  decimalSeparator: '.',

  calendar: Object.freeze({
    months: Object.freeze([
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ]),
    weekdays: Object.freeze([
      'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi',
    ]),
    /** @param {{ day: number, month: string, weekday: string }} p */
    longDate: (p) => `${p.day} ${p.month} ${p.weekday}`,
  }),

  /** Ordered by start hour; the last entry whose `fromHour` <= now wins (wraps past midnight). */
  greetings: Object.freeze([
    Object.freeze({ fromHour: 5, text: 'Günaydın' }),
    Object.freeze({ fromHour: 12, text: 'İyi günler' }),
    Object.freeze({ fromHour: 18, text: 'İyi akşamlar' }),
    Object.freeze({ fromHour: 23, text: 'İyi geceler' }),
  ]),

  ui: Object.freeze({
    appsHeading: 'UYGULAMALAR',
    allAppsHeading: 'TÜM UYGULAMALAR',
    allAppsHint: 'Geri tuşu ile ana ekrana dönün',
    moreApps: 'DİĞER UYGULAMALAR',
    browser: 'WEB TARAYICI',
    homeAutomation: 'EV OTOMASYONU',
    settingsLabel: 'Sistem ve kurtarma',
    haStatusPrefix: 'Home Assistant Entegrasyonu:',
    haStatus: Object.freeze({
      disabled: 'KAPALI',
      connecting: 'BAĞLANIYOR',
      authenticating: 'DOĞRULANIYOR',
      connected: 'AKTİF',
      reconnecting: 'YENİDEN BAĞLANIYOR',
      auth_failed: 'YETKİ HATASI',
    }),
    telemetryUnavailable: '—',
    rescueTitle: 'Sistem ve Kurtarma',
    rescueSubtitle: 'Launcher sorun çıkarırsa buradan güvenle geri dönebilirsiniz.',
    rescueActions: Object.freeze({
      smartHub: Object.freeze({
        title: "Orijinal Samsung Smart Hub'a Geç",
        description: 'Samsung ana ekranını şimdi açar. Launcher kurulu kalır.',
      }),
      rescue: Object.freeze({
        title: 'Varsayılan Launcher Ayarını Sıfırla (Rescue)',
        description: 'Home tuşunu kalıcı olarak Smart Hub\'a geri bağlar.',
      }),
      reload: Object.freeze({
        title: 'Yeniden Başlat',
        description: 'Launcher\'ı yeniden yükler, bağlantıları tazeler.',
      }),
    }),
    loadingApps: 'Uygulamalar yükleniyor…',
  }),

  toasts: Object.freeze({
    launchFailed: (label) => `${label} açılamadı`,
    inputFailed: (label) => `${label} girişine geçilemedi`,
    rescueFallback: 'Rescue uygulaması bulunamadı — Smart Hub açılıyor. Kalıcı sıfırlama için sdb aracını kullanın.',
    remoteActionRejected: (action) => `Bilinmeyen uzaktan komut: ${action}`,
    remoteActionReceived: (action) => `Home Assistant komutu: ${action}`,
    mockAction: (text) => `Önizleme · ${text}`,
    smartHubUnavailable: 'Smart Hub başlatılamadı',
  }),
});
