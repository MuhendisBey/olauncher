import { Topics } from '../core/Topics.js';
import { APP_VERSION } from '../core/Version.js';

/**
 * Footer bar component showing Home Assistant connection status and version.
 */
export class FooterBar {
  /**
   * @param {{
   *   container: HTMLElement,
   *   eventBus: import('../core/EventBus.js').EventBus,
   *   locale: typeof import('../i18n/tr.js').tr,
   *   versionText?: string
   * }} deps
   */
  constructor({ container, eventBus, locale, versionText = `v${APP_VERSION} • Gürsoy ©` }) {
    this._container = container;
    this._bus = eventBus;
    this._locale = locale;
    this._versionText = versionText;
    this._unsub = null;
  }

  start() {
    this._render();
    this._unsub = this._bus.on(Topics.HA_CONNECTION_CHANGED, ({ status }) => {
      this._updateStatus(status);
    });
  }

  destroy() {
    if (this._unsub) this._unsub();
  }

  /** @private */
  _render() {
    this._container.innerHTML = `
      <div class="footer-left">
        <span class="status-dot status-disabled" id="ha-status-dot"></span>
        <span class="footer-label">${this._locale.ui.haStatusPrefix}</span>
        <span class="footer-status-text" id="ha-status-text">${this._locale.ui.haStatus.disabled}</span>
      </div>
      <div class="footer-right">
        <span class="footer-version">${this._versionText}</span>
      </div>
    `;

    this._dotEl = this._container.querySelector('#ha-status-dot');
    this._textEl = this._container.querySelector('#ha-status-text');
  }

  /** @private */
  _updateStatus(status) {
    if (!this._dotEl || !this._textEl) return;

    this._dotEl.className = `status-dot status-${status}`;
    const localized = this._locale.ui.haStatus[status] || status.toUpperCase();
    this._textEl.textContent = localized;
  }
}
