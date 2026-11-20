/**
 * @typedef {Object} InstalledAppInfo
 * @property {string} id
 * @property {string} name
 * @property {string} [iconPath]
 * @property {boolean} [show]
 * @property {string} [packageId]
 */

/**
 * @typedef {Object} VideoSourceInfo
 * @property {string} type e.g. "HDMI", "TV"
 * @property {number} number e.g. 1, 2, 3, 4
 * @property {boolean} connected
 */

/**
 * Platform bridge contract (Adapter Pattern).
 * Application code and UI never talk directly to `window.tizen`.
 * Everything goes through this interface so it runs equally well in
 * desktop browser mock mode and on Samsung Tizen 6.5 hardware.
 *
 * @interface
 */
export class ITizenBridge {
  /** @returns {boolean} */
  isRealTv() {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<InstalledAppInfo[]>} */
  getInstalledApps() {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} appId
   * @returns {Promise<void>}
   */
  launchApp(appId) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<VideoSourceInfo[]>} */
  getSources() {
    throw new Error('Not implemented');
  }

  /**
   * @param {string} sourceType e.g. "HDMI"
   * @param {number} sourceNumber e.g. 2
   * @returns {Promise<void>}
   */
  setSource(sourceType, sourceNumber) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<void>} */
  openTvViewer() {
    throw new Error('Not implemented');
  }

  /**
   * Gracefully sends OLauncher to the background, yielding foreground surface
   * to the launched target app.
   */
  hideCurrentApp() {
    throw new Error('Not implemented');
  }

  /**
   * Gracefully exits the launcher.
   */
  exitApp() {
    throw new Error('Not implemented');
  }
}
