/**
 * Built-in defaults (internal camelCase model). `config.json` (snake_case)
 * is normalised and deep-merged over this, so every key here is optional
 * for the user and the launcher always boots — even with no config at all.
 */
export const DEFAULT_CONFIG = Object.freeze({
  household: {
    familyName: 'Gürsoy Ailesi',
  },
  locale: 'tr-TR',

  display: {
    /** Design canvas. All rem sizes are authored against this. */
    designWidth: 3840,
    designHeight: 2160,
    wallpaper: 'assets/wallpapers/default-wallpaper.svg',
  },

  boot: {
    enabled: true,
    sound: true,
    durationMs: 6200,
    title: 'G Ü R S O Y',
    subtitle: 'SMART CINEMA • 4K HDR',
  },

  homeAssistant: {
    enabled: false,
    haUrl: '',
    accessToken: '',
    /** role → entity_id. Roles are what the UI understands; ids are yours. */
    entities: {
      temperature: 'sensor.living_room_temperature',
      weather: 'weather.home',
    },
    temperatureLabel: 'Salon',
    /** "trigger" = server-side filtered (fast, default) · "events" = raw state_changed stream. */
    subscriptionMode: 'trigger',
    remoteActionEvent: 'tizen_tv_action',
    /** Optional target filter: events with data.target !== deviceId are ignored. */
    deviceId: 'living_room_tv',
    /** Entity ID of the input_select helper tracking the active input source */
    sourceSelectEntity: 'input_select.living_room_tv_source',
    requestTimeoutMs: 10000,
    heartbeatIntervalMs: 30000,
    reconnect: {
      initialDelayMs: 1000,
      maxDelayMs: 60000,
      multiplier: 2,
      jitterRatio: 0.25,
    },
  },

  /** Fixed input-source cards, rendered first on the rail. */
  inputs: [
    {
      id: 'xbox',
      label: 'XBOX',
      sourceType: 'HDMI',
      sourceNumber: 2,
      theme: 'xbox',
      icon: 'icon-xbox',
      /** "viewer" = switch then open Samsung TV viewer · "switch" = only switch source. */
      afterSwitch: 'viewer',
    },
  ],

  apps: {
    browser: {
      appId: 'org.tizen.browser',
      theme: 'browser',
      icon: 'icon-globe',
    },
    /** Shown first, in this order, when installed. Labels override store names. */
    pinned: [
      { id: 'org.tizen.netflix-app', label: 'Netflix' },
      { id: 'org.tizen.primevideo', label: 'Prime Video' },
      { id: 'MCmYXNxgcu.DisneyPlus', label: 'Disney+' },
      { id: '9Ur5IzDKqV.TizenYouTube', label: 'YouTube' },
      { id: 'rJeHak5zRg.Spotify', label: 'Spotify' },
      { id: 'com.samsung.tv.aria-video', label: 'Apple TV' },
    ],
    /** Never listed (system/service apps that still report `show: true`). */
    hidden: [
      'adplatform.ADPlayer', 'WykOS4t4F0.cmsWebApp', '25emanual3.emanual',
      'ZODRT12q2l.WebAccountExtension', 'ByJlgt0XeD.CastSettingsApp',
      'tv6pbVMQFF.PrivacyChoices', '2022ePop01.SmartTV', 'w2VwCK465D.OTApp',
      'J9fZJDMi1v.SecurityCenter', 'com.samsung.tv.cobalt-yt',
    ],
    /** Dynamic cards on the home rail (after fixed cards, before "more"). */
    railLimit: 7,
  },

  system: {
    selfAppId: 'OLauncher1.OLauncher',
    /**
     * Tried in order by the watchdog and "Smart Hub'a Geç". 2022 Tizen 6.5
     * models report `com.samsung.tv.csfs` as Home; `.home` is a fallback.
     * Replace the first entry with the value your sdb baseline reports.
     */
    smartHubAppIds: ['com.samsung.tv.csfs', 'com.samsung.tv.home'],
    rescueAppId: 'com.muhendisbey.olauncher.rescue',
    tvViewerAppId: 'org.tizen.tv-viewer',
    platformTimeoutMs: 8000,
  },
});
