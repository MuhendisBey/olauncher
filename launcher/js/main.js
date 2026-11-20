import { Logger } from './core/Logger.js';
import { EventBus } from './core/EventBus.js';
import { Topics } from './core/Topics.js';
import { ConfigLoader } from './config/ConfigLoader.js';
import { XhrJsonTransport } from './config/XhrJsonTransport.js';
import { resolveLocale } from './i18n/index.js';
import { PlatformBridgeFactory } from './platform/PlatformBridgeFactory.js';
import { HomeAssistantClient } from './ha/HomeAssistantClient.js';
import { NavigationManager } from './input/NavigationManager.js';
import { AppCardFactory } from './ui/AppCardFactory.js';
import { ClockHeader } from './ui/ClockHeader.js';
import { TelemetryHeader } from './ui/TelemetryHeader.js';
import { RescueModal } from './ui/RescueModal.js';
import { AllAppsModal } from './ui/AllAppsModal.js';
import { FooterBar } from './ui/FooterBar.js';
import { ToastManager } from './ui/ToastManager.js';
import { KeyCodes } from './input/KeyCodes.js';

const APPS_CACHE_KEY = 'olauncher.apps.v1';

// Whitelist of allowed Samsung/Tizen system-prefixed packages that are real consumer apps
const ALLOWED_SYSTEM_APPS = new Set([
  'org.tizen.browser',
  'org.tizen.netflix-app',
  'org.tizen.primevideo',
  'com.samsung.tv.aria-video', // Apple TV
  'org.tizen.gallery',
  'com.samsung.tv.gallery'
]);

const SYSTEM_BLACKLIST_REGEX = /(?:service|worker|preview|promotion|plugin|launcher|test|sdk|^ep[ -]|factory|daemon|provider|cloning|sharing|smartthings|contentsharing|emanual|adplatform|castsettings|privacychoices|webaccountextension|dial|airplay|miracast|screenmirror|retail|account|diagnostics|remoteservice|deviceauth|framework|system|voice|bixby|keyboard|ime|ambient|wallpaper|screensaver|multiview|audio-feedback|clock|setting)/i;

/**
 * Main application orchestrator for OLauncher.
 */
class OLauncherApp {
  constructor() {
    this._logger = new Logger({ scope: 'OLauncher' });
    this._bus = new EventBus({
      logger: this._logger,
      replayTopics: [Topics.HA_CONNECTION_CHANGED]
    });
    this._config = null;
    this._locale = null;
    this._bridge = null;
    this._ha = null;
    this._nav = null;
    this._installedApps = [];
    this._visibleApps = [];
    this._appsSignature = null;
    this._isSuspended = false;
    this._coldBootRetryTimer = null;
    this._launchRecoveryTimer = null;
    this._haSuspendTimer = null;

    // Global error capture forwarded to Logger & Home Assistant telemetry
    window.addEventListener('error', (ev) => {
      if (document.hidden) return;
      this._logger.error('Runtime error:', ev.message || ev, ev.filename, ev.lineno);
    });
    window.addEventListener('unhandledrejection', (ev) => {
      if (document.hidden) return;
      this._logger.error('Unhandled rejection:', ev.reason?.message || ev.reason);
    });
  }

  async start() {
    this._logger.info('Starting OLauncher 4K Application...');

    // 1. Load configuration
    const transport = new XhrJsonTransport();
    const configLoader = new ConfigLoader({ transport, logger: this._logger });
    this._config = await configLoader.load('config.json');

    // 2. Resolve localization
    this._locale = resolveLocale(this._config.locale);

    // 3. Stage readiness (Direct zero-delay entry)
    const stage = document.getElementById('stage');
    if (stage) {
      stage.classList.add('stage-ready');
    }

    // 4. Initialize Platform Bridge (Zero unsolicited hardware plane / key grabs)
    this._bridge = PlatformBridgeFactory.create({
      eventBus: this._bus,
      logger: this._logger
    });

    // 5. Initialize Navigation (Pure CSS virtual focus)
    this._nav = new NavigationManager({
      logger: this._logger,
      onActivity: () => {
        if (this._isSuspended && (typeof document === 'undefined' || !document.hidden)) {
          this._logger.info('Remote input received while suspended; waking activity');
          this._resumeActivity();
        }
      }
    });
    this._nav.init();

    // 6. Mount UI Shell & Modals
    this._mountUI();

    // 7. Render 7-card rail immediately from cache/pinned defaults for <16ms startup
    const cachedApps = this._readCachedApps();
    this._visibleApps = cachedApps;
    this._renderRail(cachedApps);
    this._nav.focusDefault();

    // 8. Connect Home Assistant (Foreground only)
    this._ha = new HomeAssistantClient({
      config: this._config.homeAssistant,
      eventBus: this._bus,
      logger: this._logger
    });
    if (!document.hidden) {
      this._ha.start();
    }
    this._logger.setOnLog((level, scope, msg) => {
      if (!this._isSuspended && !document.hidden) {
        this._ha?.sendLog(level, scope, msg);
      }
    });

    // 9. Handle background/foreground lifecycle with strict zero-footprint teardown
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._logger.info('OLauncher backgrounded; suspending activities, closing sockets, and yielding display');
        this._suspendActivity(true);
        try {
          this._bridge?.hideCurrentApp?.();
        } catch (_) {}
      } else {
        this._logger.info('OLauncher resumed via visibilitychange; restoring clock, telemetry, and navigation focus');
        this._resumeActivity();
      }
    });

    window.addEventListener('pagehide', () => {
      this._suspendActivity(true);
    });

    // 10. Refresh installed TV apps in foreground
    await this._refreshInstalledApps();

    this._logger.info('OLauncher successfully booted');
  }

  /**
   * Synchronously tears down all timers, sockets, and native focus so OLauncher
   * has zero OS/compositor footprint while another app (e.g. org.tizen.browser) runs.
   * @param {boolean} [clearOverlays=false]
   * @private
   */
  _suspendActivity(clearOverlays = false) {
    this._isSuspended = true;

    if (this._coldBootRetryTimer) {
      clearTimeout(this._coldBootRetryTimer);
      this._coldBootRetryTimer = null;
    }
    if (this._launchRecoveryTimer) {
      clearTimeout(this._launchRecoveryTimer);
      this._launchRecoveryTimer = null;
    }

    this._clock?.pause();
    this._nav?.blurNativeFocus();

    // Allow outgoing WebSocket telemetry/source updates to flush cleanly before tearing down the socket
    if (this._haSuspendTimer) {
      clearTimeout(this._haSuspendTimer);
    }
    this._haSuspendTimer = setTimeout(() => {
      this._haSuspendTimer = null;
      if (this._isSuspended) {
        this._ha?.pause();
      }
    }, 400);

    if (clearOverlays) {
      this._toasts?.clear();
    }
  }

  /**
   * Restores clock and Home Assistant telemetry when OLauncher returns to foreground.
   * @private
   */
  _resumeActivity() {
    if (typeof document !== 'undefined' && document.hidden) return;

    if (this._launchRecoveryTimer) {
      clearTimeout(this._launchRecoveryTimer);
      this._launchRecoveryTimer = null;
    }
    if (this._haSuspendTimer) {
      clearTimeout(this._haSuspendTimer);
      this._haSuspendTimer = null;
    }

    this._isSuspended = false;
    this._clock?.resume();
    this._ha?.resume();
    this._ha?.reportActiveSource('Ana Ekran');

    if (!this._nav?.getCurrentFocus() || !document.body.contains(this._nav.getCurrentFocus())) {
      this._nav?.focusDefault();
    }
    this._rehydrateGpuSurface();
  }

  /**
   * Forces Chromium Compositor to invalidate stale Mali-G52 GPU tile damage buffers
   * following HDR10+ video mode switches, without full page reload or visual flicker.
   * @private
   */
  _rehydrateGpuSurface() {
    try {
      const stage = document.getElementById('stage');
      if (stage) {
        void stage.offsetHeight;
        window.requestAnimationFrame(() => {
          if (stage && !document.hidden) {
            stage.style.willChange = 'transform';
            window.requestAnimationFrame(() => {
              stage.style.willChange = 'auto';
            });
          }
        });
      }
    } catch (_) {}
  }

  /**
   * Arms a single safety timer after launching an external app on real TV:
   * if OLauncher is still visible after 5s (e.g. partial overlay), resume telemetry.
   * Cancelled immediately as soon as visibilitychange hides OLauncher.
   * @private
   */
  _armLaunchRecovery() {
    if (!this._bridge.isRealTv()) return;
    if (this._launchRecoveryTimer) {
      clearTimeout(this._launchRecoveryTimer);
    }
    this._launchRecoveryTimer = setTimeout(() => {
      this._launchRecoveryTimer = null;
      if (!document.hidden) {
        this._resumeActivity();
      }
    }, 5000);
  }

  /** @private */
  _mountUI() {
    // Wallpaper background
    const bgContainer = document.getElementById('wallpaper-container');
    if (bgContainer && this._config.display?.wallpaper) {
      bgContainer.style.backgroundImage = `url('${this._config.display.wallpaper}')`;
    }

    // Top-left Clock & Greeting Header
    const clockContainer = document.getElementById('clock-header');
    if (clockContainer) {
      this._clock = new ClockHeader({
        container: clockContainer,
        locale: this._locale,
        familyName: this._config.household?.familyName
      });
      this._clock.start();
    }

    // Modals
    const modalContainer = document.getElementById('modal-container');
    this._rescueModal = new RescueModal({
      container: modalContainer,
      locale: this._locale,
      onSelectSmartHub: () => this._launchSmartHub(),
      onSelectRescue: () => this._triggerRescue(),
      onSelectReload: () => window.location.reload(),
      onClose: () => this._nav.closeModal()
    });

    this._allAppsModal = new AllAppsModal({
      container: modalContainer,
      locale: this._locale,
      onLaunchApp: (appId) => this._launchApp(appId),
      onClose: () => this._nav.closeModal()
    });

    // Top-right Telemetry Header
    const telemetryContainer = document.getElementById('telemetry-header');
    if (telemetryContainer) {
      this._telemetry = new TelemetryHeader({
        container: telemetryContainer,
        eventBus: this._bus,
        locale: this._locale,
        temperatureLabel: this._config.homeAssistant?.temperatureLabel || 'Salon',
        onOpenRescue: () => {
          this._rescueModal.show();
          this._nav.openModal(modalContainer);
        }
      });
      this._telemetry.start();
    }

    // Footer Bar
    const footerContainer = document.getElementById('footer-bar');
    if (footerContainer) {
      this._footer = new FooterBar({
        container: footerContainer,
        eventBus: this._bus,
        locale: this._locale
      });
      this._footer.start();
    }

    // Toast Manager
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      this._toasts = new ToastManager({
        container: toastContainer,
        eventBus: this._bus
      });
      this._toasts.init();
    }

    // Listen to Home Assistant Remote Actions (HA -> TV / Siri)
    this._bus.on(Topics.HA_REMOTE_ACTION, ({ action, payload }) => {
      this._handleRemoteAction(action, payload);
    });
  }

  /** @private */
  _readCachedApps() {
    try {
      const raw = window.localStorage.getItem(APPS_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  /** @private */
  _writeCachedApps(apps) {
    try {
      window.localStorage.setItem(APPS_CACHE_KEY, JSON.stringify(apps));
    } catch (_) {}
  }

  /** @private */
  _filterVisibleApps(rawApps) {
    const hiddenSet = new Set(this._config.apps?.hidden || []);
    const selfId = this._config.system?.selfAppId;

    const visibleApps = (rawApps || []).filter((a) => {
      if (!a || !a.name || !a.id) return false;
      if (a.id === selfId || hiddenSet.has(a.id)) return false;
      if (a.show === false) return false;

      const id = a.id.toLowerCase();
      const name = a.name.toLowerCase();

      if (id.startsWith('com.samsung.') || id.startsWith('org.tizen.')) {
        if (!ALLOWED_SYSTEM_APPS.has(a.id)) return false;
      }

      if (SYSTEM_BLACKLIST_REGEX.test(`${id} ${name}`)) return false;

      return true;
    });

    visibleApps.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'tr', { sensitivity: 'base' }));
    return visibleApps;
  }

  /** @private */
  _computeAppsSignature(apps) {
    return (apps || []).map((a) => `${a.id}|${a.name}|${a.iconPath || ''}`).join('\n');
  }

  /** @private */
  _renderRail(visibleApps) {
    const rail = document.getElementById('apps-rail');
    if (!rail) return;

    const sig = this._computeAppsSignature(visibleApps);
    if (this._appsSignature !== null && sig === this._appsSignature && rail.children.length > 0) {
      return;
    }

    const previousFocusId = this._nav?.getCurrentFocus()?.getAttribute('data-id') || null;
    const isInRail = previousFocusId && rail.contains(this._nav.getCurrentFocus());

    this._appsSignature = sig;
    rail.innerHTML = '';

    // A) Web Browser card (Pinned first)
    const browserCfg = this._config.apps?.browser || {};
    const browserAppId = browserCfg.appId || 'org.tizen.browser';
    const browserLabel = this._locale.ui.browser;
    const browserCard = AppCardFactory.createBrowserCard(browserLabel, () => {
      this._launchApp(browserAppId);
    });
    rail.appendChild(browserCard);

    // B) Fixed input cards (e.g. Xbox HDMI)
    (this._config.inputs || []).forEach((input) => {
      const card = AppCardFactory.createInputCard(input, () => this._switchInput(input));
      rail.appendChild(card);
    });

    // C) Pinned consumer apps (Total cards strictly 7)
    const maxPinnedSlots = Math.max(1, 7 - 1 - (this._config.inputs || []).length - 1);
    const pinned = (this._config.apps?.pinned || []).slice(0, maxPinnedSlots);
    const pinnedCardsRendered = new Set([browserAppId]);

    pinned.forEach((p) => {
      const installedMatch = visibleApps.find(
        (a) => a.id === p.id || (p.label && a.name.toLowerCase().includes(p.label.toLowerCase()))
      );

      if (this._bridge.isRealTv() && visibleApps.length > 0 && !installedMatch) {
        this._logger.info(`Pinned app "${p.label || p.id}" TV'de yüklü değil, atlanıyor.`);
        return;
      }

      const appId = installedMatch ? installedMatch.id : p.id;
      const label = p.label || (installedMatch ? installedMatch.name : appId);

      const card = AppCardFactory.createAppCard({ id: appId, label }, () => this._launchApp(appId));
      rail.appendChild(card);
      pinnedCardsRendered.add(appId);
    });

    // D) Fill remaining slots up to maxPinnedSlots with visible apps
    for (const app of visibleApps) {
      if (rail.children.length >= 1 + (this._config.inputs || []).length + maxPinnedSlots) break;
      if (!pinnedCardsRendered.has(app.id)) {
        const card = AppCardFactory.createAppCard({ id: app.id, label: app.name }, () => this._launchApp(app.id));
        rail.appendChild(card);
        pinnedCardsRendered.add(app.id);
      }
    }

    // E) "DİĞER UYGULAMALAR" card (7th card)
    const moreAppsCard = AppCardFactory.createMoreAppsCard(this._locale.ui.moreApps, async () => {
      if ((!this._visibleApps || this._visibleApps.length === 0) && this._bridge.isRealTv()) {
        await this._refreshInstalledApps();
      }
      this._allAppsModal.show(this._visibleApps || []);
      const modalContainer = document.getElementById('modal-container');
      this._nav.openModal(modalContainer);
    });
    rail.appendChild(moreAppsCard);

    if (isInRail && previousFocusId) {
      this._nav.focusDefault(previousFocusId);
    }
  }

  /** @private */
  async _refreshInstalledApps() {
    if (this._isSuspended || document.hidden) return;

    try {
      this._installedApps = await this._bridge.getInstalledApps();
    } catch (err) {
      this._logger.warn('Failed to get apps from bridge, using cached/pinned defaults:', err);
      this._installedApps = [];
    }

    if (this._isSuspended || document.hidden) return;

    if (this._installedApps.length > 0) {
      const visibleApps = this._filterVisibleApps(this._installedApps);
      this._visibleApps = visibleApps;
      this._writeCachedApps(visibleApps);
      this._renderRail(visibleApps);
      return;
    }

    // Self-healing cold boot retry (cancelled immediately if user opens an app)
    if (this._bridge.isRealTv() && !this._coldBootRetryTimer) {
      this._logger.warn('TV uygulama servisi cold-boot durumunda. 3.5 sn içinde yeniden taranacak...');
      this._coldBootRetryTimer = setTimeout(async () => {
        this._coldBootRetryTimer = null;
        if (this._isSuspended || document.hidden) return;
        await this._refreshInstalledApps();
      }, 3500);
    }
  }

  /**
   * Resolves a user-friendly source name matching HA source_list.
   * @param {string} appId
   * @returns {string}
   * @private
   */
  _resolveSourceName(appId) {
    const id = String(appId || '').toLowerCase();
    if (id.includes('youtube')) return 'YouTube';
    if (id.includes('netflix')) return 'Netflix';
    if (id.includes('stremio')) return 'Stremio';
    if (id.includes('spotify')) return 'Spotify';
    if (id.includes('browser') || id.includes('internet')) return 'Web Tarayıcı';
    if (id.includes('prime')) return 'Prime Video';
    if (id.includes('disney')) return 'Disney+';

    const match = (this._visibleApps || []).find((a) => a.id === appId);
    if (match && match.name) return match.name;

    return appId;
  }

  /** @private */
  async _launchApp(appId) {
    let targetId = appId;
    if (targetId === 'stremio') {
      targetId = 'IkWsFHtOY9.Stremio';
    }

    const sourceName = this._resolveSourceName(appId);
    this._ha?.reportActiveSource(sourceName);

    if (this._bridge.isRealTv()) {
      this._suspendActivity(true);
    }

    try {
      await this._bridge.launchApp(targetId);
      this._armLaunchRecovery();
    } catch (err) {
      if (this._bridge.isRealTv()) {
        this._resumeActivity();
      }
      this._logger.error(`Launch failed for ${targetId}:`, err);
      this._bus.emit(Topics.TOAST, {
        message: this._locale.toasts.launchFailed(targetId),
        durationMs: 3000
      });
    }
  }

  /** @private */
  async _switchInput(input) {
    const sourceName = input?.label || (input?.id ? input.id.toUpperCase() : 'XBOX');
    this._ha?.reportActiveSource(sourceName);

    if (this._bridge.isRealTv()) {
      this._suspendActivity(true);
    }

    try {
      if (typeof window !== 'undefined') {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        if (typeof window.blur === 'function') {
          window.blur();
        }
      }
      await this._bridge.setSource(input.sourceType, input.sourceNumber);
      if (input.afterSwitch === 'viewer') {
        await this._bridge.openTvViewer();
      }
      this._armLaunchRecovery();
    } catch (err) {
      if (this._bridge.isRealTv()) {
        this._resumeActivity();
      }
      this._logger.error(`Input switch failed for ${input.label}:`, err);
      this._bus.emit(Topics.TOAST, {
        message: this._locale.toasts.inputFailed(input.label),
        durationMs: 3000
      });
    }
  }

  /** @private */
  async _launchSmartHub() {
    const candidates = this._config.system?.smartHubAppIds || ['com.samsung.tv.csfs', 'com.samsung.tv.home'];
    if (this._bridge.isRealTv()) {
      this._suspendActivity(true);
    }

    for (const id of candidates) {
      try {
        await this._bridge.launchApp(id);
        this._armLaunchRecovery();
        return;
      } catch (err) {
        this._logger.warn(`Failed candidate Smart Hub id ${id}:`, err);
      }
    }

    if (this._bridge.isRealTv()) {
      this._resumeActivity();
    }
    this._bus.emit(Topics.TOAST, { message: this._locale.toasts.smartHubUnavailable });
  }

  /** @private */
  async _triggerRescue() {
    const rescueAppId = this._config.system?.rescueAppId || 'com.muhendisbey.olauncher.rescue';
    if (this._bridge.isRealTv()) {
      this._suspendActivity(true);
    }

    try {
      await this._bridge.launchApp(rescueAppId);
      this._armLaunchRecovery();
    } catch (err) {
      this._logger.warn(`Rescue app ${rescueAppId} not found, falling back to Smart Hub launch:`, err);
      if (this._bridge.isRealTv()) {
        this._resumeActivity();
      }
      this._bus.emit(Topics.TOAST, {
        message: this._locale.toasts.rescueFallback,
        durationMs: 6000
      });
      await this._launchSmartHub();
    }
  }

  /** @private */
  _handleRemoteAction(action, payload = {}) {
    const act = (action || '').toLowerCase().trim();
    this._logger.info(`Handling remote action: "${act}"`, payload);

    const toastFeedback = {
      netflix: 'Siri: Netflix Açılıyor...',
      youtube: 'Siri: YouTube Açılıyor...',
      browser: 'Siri: Web Tarayıcı Açılıyor...',
      internet: 'Siri: İnternet Açılıyor...',
      web: 'Siri: Web Tarayıcı Açılıyor...',
      stremio: 'Siri: Stremio Açılıyor...',
      spotify: 'Siri: Spotify Açılıyor...',
      xbox: 'Siri: XBOX Açılıyor...',
      disney: 'Siri: Disney+ Açılıyor...',
      disneyplus: 'Siri: Disney+ Açılıyor...',
      prime: 'Siri: Prime Video Açılıyor...',
      primevideo: 'Siri: Prime Video Açılıyor...',
      home: 'Siri: Ana Ekrana Dönülüyor...',
      smarthub: 'Siri: Samsung Smart Hub Açılıyor...',
      play: 'Siri: Oynatılıyor ▶',
      pause: 'Siri: Duraklatıldı ⏸',
      play_pause: 'Siri: Oynat / Duraklat ⏯'
    };

    if (toastFeedback[act]) {
      this._bus.emit(Topics.TOAST, {
        message: toastFeedback[act],
        durationMs: 3000
      });
    }

    switch (act) {
      case 'netflix': {
        this._launchApp('org.tizen.netflix-app');
        break;
      }
      case 'youtube': {
        this._launchApp('9Ur5IzDKqV.TizenYouTube');
        break;
      }
      case 'browser':
      case 'internet':
      case 'web': {
        const browserCfg = this._config.apps?.browser || {};
        this._launchApp(browserCfg.appId || 'org.tizen.browser');
        break;
      }
      case 'stremio': {
        const match = (this._visibleApps || []).find((a) => a.id === 'stremio' || (a.name && a.name.toLowerCase().includes('stremio')));
        this._launchApp(match ? match.id : 'stremio');
        break;
      }
      case 'spotify': {
        const match = (this._visibleApps || []).find((a) => a.id.includes('Spotify') || (a.name && a.name.toLowerCase().includes('spotify')));
        this._launchApp(match ? match.id : 'rJeHak5zRg.Spotify');
        break;
      }
      case 'disney':
      case 'disneyplus': {
        this._launchApp('MCmYXNxgcu.DisneyPlus');
        break;
      }
      case 'prime':
      case 'primevideo': {
        this._launchApp('org.tizen.primevideo');
        break;
      }
      case 'xbox': {
        const xbox = (this._config.inputs || []).find((i) => i.id === 'xbox');
        if (xbox) this._switchInput(xbox);
        break;
      }
      case 'smarthub': {
        this._launchSmartHub();
        break;
      }
      case 'home': {
        this._ha?.reportActiveSource('Ana Ekran');
        if (this._allAppsModal) this._allAppsModal.close();
        if (this._rescueModal) this._rescueModal.close();
        this._nav.focusDefault();
        break;
      }
      case 'play':
      case 'pause':
      case 'play_pause':
      case 'toggle_play': {
        const keyCode = act === 'pause' ? KeyCodes.MEDIA_PAUSE : (act === 'play' ? KeyCodes.MEDIA_PLAY : KeyCodes.MEDIA_PLAY_PAUSE);
        window.dispatchEvent(new KeyboardEvent('keydown', { keyCode, bubbles: true }));
        window.dispatchEvent(new KeyboardEvent('keyup', { keyCode, bubbles: true }));
        this._bus.emit(Topics.MEDIA_PLAY_PAUSE, { action: act, keyCode });
        this._logger.info(`Executed media action "${act}" with keyCode ${keyCode}`);
        break;
      }
      case 'launch': {
        const targetId = payload?.app_id || payload?.appId || payload?.id;
        if (targetId) {
          this._launchApp(targetId);
        }
        break;
      }
      case 'rescue': {
        this._triggerRescue();
        break;
      }
      case 'reload': {
        window.location.reload();
        break;
      }
      default:
        this._logger.info(`Unknown remote action: ${act}`);
    }
  }
}

// Bootstrap once DOM is ready (or immediately if already parsed)
function bootstrap() {
  const app = new OLauncherApp();
  app.start().catch((err) => {
    console.error('[OLauncher] Fatal boot error:', err);
  });
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
