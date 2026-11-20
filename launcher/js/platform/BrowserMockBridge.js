import { ITizenBridge } from './ITizenBridge.js';
import { Topics } from '../core/Topics.js';

/**
 * Mock platform implementation for desktop browser preview.
 * Simulates Samsung Tizen TV environment without any TV hardware required.
 */
export class BrowserMockBridge extends ITizenBridge {
  /**
   * @param {{ eventBus: import('../core/EventBus.js').EventBus, logger: import('../core/Logger.js').Logger }} deps
   */
  constructor({ eventBus, logger }) {
    super();
    this._bus = eventBus;
    this._logger = logger.child('BrowserMockBridge');
    this._mockApps = [
      { id: 'com.stremio.one', name: 'Stremio', show: true },
      { id: 'rJeHak5zRg.Spotify', name: 'Spotify', show: true },
      { id: '9Ur5IzDKqV.TizenYouTube', name: 'YouTube', show: true },
      { id: 'org.tizen.netflix-app', name: 'Netflix', show: true },
      { id: 'org.tizen.primevideo', name: 'Prime Video', show: true },
      { id: 'MCmYXNxgcu.DisneyPlus', name: 'Disney+', show: true },
      { id: 'com.samsung.tv.aria-video', name: 'Apple TV', show: true },
      { id: 'org.tizen.browser', name: 'Web Tarayıcı', show: true },
      { id: 'xvvl3S1TT1.TizenTubeStandalone', name: 'TizenTube', show: true },
      { id: 'Jz7aUrV2Q4.Twitch', name: 'Twitch', show: true },
      { id: 'com.samsung.tv.csfs', name: 'Samsung Smart Hub', show: false },
      { id: 'com.samsung.tv.home', name: 'Samsung Home', show: false },
      { id: 'org.tizen.tv-viewer', name: 'TV Viewer', show: false }
    ];

    this._mockSources = [
      { type: 'HDMI', number: 1, connected: false },
      { type: 'HDMI', number: 2, connected: true }, // Xbox
      { type: 'HDMI', number: 3, connected: false },
      { type: 'HDMI', number: 4, connected: false }
    ];

    this._logger.info('BrowserMockBridge initialized (Desktop preview mode)');
  }

  isRealTv() {
    return false;
  }

  async getInstalledApps() {
    this._logger.debug('Mock getInstalledApps returning', this._mockApps.length, 'apps');
    return [...this._mockApps];
  }

  async launchApp(appId) {
    this._logger.info(`[MOCK LAUNCH] App ID: ${appId}`);
    const found = this._mockApps.find((a) => a.id === appId);
    const label = found ? found.name : appId;
    this._bus.emit(Topics.TOAST, {
      message: `[Önizleme] "${label}" uygulaması başlatıldı (${appId})`,
      durationMs: 3500
    });
  }

  async getSources() {
    return [...this._mockSources];
  }

  async setSource(sourceType, sourceNumber) {
    this._logger.info(`[MOCK INPUT] Switched source to ${sourceType} ${sourceNumber}`);
    this._bus.emit(Topics.TOAST, {
      message: `[Önizleme] Giriş değiştirildi: ${sourceType} ${sourceNumber}`,
      durationMs: 3500
    });
  }

  async openTvViewer() {
    this._logger.info('[MOCK VIEWER] Opened TV Viewer');
    this._bus.emit(Topics.TOAST, {
      message: '[Önizleme] Samsung TV Viewer açıldı',
      durationMs: 3000
    });
  }

  hideCurrentApp() {
    this._logger.debug('[MOCK HIDE] Launcher yielded to background');
  }

  exitApp() {
    this._logger.info('[MOCK EXIT] Exit requested');
    this._bus.emit(Topics.TOAST, {
      message: '[Önizleme] Launcher çıkış isteği alındı',
      durationMs: 2500
    });
  }
}
