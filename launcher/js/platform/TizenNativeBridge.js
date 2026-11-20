import { ITizenBridge } from './ITizenBridge.js';
import { fromCallback, withTimeout } from '../core/async.js';

/**
 * Real Samsung Tizen 6.5 Web API Bridge.
 * Talks to `window.tizen` APIs with guarded timeouts and error wrappers.
 */
export class TizenNativeBridge extends ITizenBridge {
  /**
   * @param {{ logger: import('../core/Logger.js').Logger, timeoutMs?: number }} deps
   */
  constructor({ logger, timeoutMs = 8000 }) {
    super();
    this._logger = logger.child('TizenNativeBridge');
    this._timeoutMs = timeoutMs;
    this._tizen = window.tizen;
  }

  isRealTv() {
    return true;
  }

  async getInstalledApps() {
    if (!this._tizen?.application?.getAppsInfo) {
      throw new Error('tizen.application.getAppsInfo API mevcut değil');
    }

    const fetchApps = fromCallback((resolve, reject) => {
      this._tizen.application.getAppsInfo(resolve, reject);
    });

    const list = await withTimeout(fetchApps, this._timeoutMs, 'getAppsInfo');
    return (list || []).map((app) => ({
      id: app.id,
      name: app.name,
      iconPath: app.iconPath || '',
      show: Boolean(app.show),
      packageId: app.packageId
    }));
  }

  async launchApp(appId) {
    if (!this._tizen?.application?.launch) {
      throw new Error('tizen.application.launch API mevcut değil');
    }

    this._logger.info(`Launching Tizen app: ${appId}`);

    // Cleanly blur native window and active element focus before handoff
    try {
      if (typeof window !== 'undefined') {
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
          document.activeElement.blur();
        }
        if (typeof window.blur === 'function') {
          window.blur();
        }
      }
    } catch (_) {}

    const launch = fromCallback((resolve, reject) => {
      this._tizen.application.launch(appId, resolve, reject);
    });
    await withTimeout(launch, this._timeoutMs, `launch(${appId})`);
  }

  async getSources() {
    if (!this._tizen?.systeminfo?.getPropertyValue) {
      this._logger.warn('tizen.systeminfo API eksik; kaynak listesi alınamadı');
      return [];
    }

    const fetchSources = fromCallback((resolve, reject) => {
      this._tizen.systeminfo.getPropertyValue('VIDEOSOURCE', resolve, reject);
    });

    try {
      const info = await withTimeout(fetchSources, this._timeoutMs, 'getPropertyValue(VIDEOSOURCE)');
      const result = [];
      (info.connected || []).forEach((s) => {
        result.push({ type: s.type, number: s.number, connected: true });
      });
      (info.disconnected || []).forEach((s) => {
        result.push({ type: s.type, number: s.number, connected: false });
      });
      return result;
    } catch (err) {
      this._logger.warn('VIDEOSOURCE query failed:', err);
      return [];
    }
  }

  async setSource(sourceType, sourceNumber) {
    if (!this._tizen?.tvwindow?.setSource) {
      throw new Error('tizen.tvwindow.setSource API mevcut değil');
    }

    const sources = await this.getSources();
    const target = sources.find((s) => s.type === sourceType && s.number === sourceNumber) || {
      type: sourceType,
      number: sourceNumber
    };

    const switchSrc = fromCallback((resolve, reject) => {
      this._tizen.tvwindow.setSource(target, resolve, reject, 'MAIN');
    });

    await withTimeout(switchSrc, this._timeoutMs, `setSource(${sourceType} ${sourceNumber})`);
  }

  async openTvViewer() {
    await this.launchApp('org.tizen.tv-viewer');
  }

  /**
   * Hides OLauncher surface so the launched app (YouTube, Browser, Netflix)
   * gains exclusive foreground access to the hardware video plane and display engine.
   */
  hideCurrentApp() {
    try {
      if (this._tizen?.application?.getCurrentApplication) {
        const currentApp = this._tizen.application.getCurrentApplication();
        if (currentApp && typeof currentApp.hide === 'function') {
          this._logger.info('Yielding display surface to background via currentApp.hide()');
          currentApp.hide();
        }
      }
    } catch (err) {
      this._logger.warn('hideCurrentApp failed:', err);
    }
  }

  exitApp() {
    try {
      if (this._tizen?.application?.getCurrentApplication) {
        this._tizen.application.getCurrentApplication().exit();
      }
    } catch (err) {
      this._logger.warn('exitApp failed:', err);
    }
  }
}
