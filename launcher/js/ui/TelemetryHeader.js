import { Icons } from './Icons.js';
import { Topics } from '../core/Topics.js';

const TEMP_CACHE_KEY = 'olauncher.telemetry.temp.v1';

/**
 * Top-right Home Assistant telemetry block and Rescue/Settings trigger button.
 */
export class TelemetryHeader {
  /**
   * @param {{
   *   container: HTMLElement,
   *   eventBus: import('../core/EventBus.js').EventBus,
   *   locale: typeof import('../i18n/tr.js').tr,
   *   temperatureLabel: string,
   *   onOpenRescue: () => void
   * }} deps
   */
  constructor({ container, eventBus, locale, temperatureLabel, onOpenRescue }) {
    this._container = container;
    this._bus = eventBus;
    this._locale = locale;
    this._tempLabel = temperatureLabel || 'Salon';
    this._onOpenRescue = onOpenRescue;

    this._unsubscribers = [];
    this._currentTemp = this._readCachedTemp();
  }

  start() {
    this._render();
    this._setupSubscriptions();
  }

  destroy() {
    this._unsubscribers.forEach((u) => u());
    this._unsubscribers = [];
  }

  /** @private */
  _readCachedTemp() {
    try {
      const saved = window.localStorage.getItem(TEMP_CACHE_KEY);
      return saved || null;
    } catch (_) {
      return null;
    }
  }

  /** @private */
  _writeCachedTemp(val) {
    try {
      window.localStorage.setItem(TEMP_CACHE_KEY, String(val));
    } catch (_) {}
  }

  /** @private */
  _render() {
    const initialTemp = this._currentTemp ? `${this._tempLabel}: ${this._currentTemp}°C` : `${this._tempLabel}: --.-°C`;
    this._container.innerHTML = `
      <div class="telemetry-info">
        <div class="telemetry-category">${this._locale.ui.homeAutomation}</div>
        <div class="telemetry-reading">
          <span class="telemetry-temp" id="telemetry-temp">${this._escape(initialTemp)}</span>
          <span class="telemetry-icon">${Icons.THERMOMETER}</span>
        </div>
      </div>
      <button
        type="button"
        id="btn-settings-wrench"
        class="wrench-button focusable"
        tabindex="-1"
        aria-label="${this._locale.ui.settingsLabel}"
      >
        ${Icons.WRENCH}
      </button>
    `;

    this._tempValueEl = this._container.querySelector('#telemetry-temp');
    this._wrenchBtn = this._container.querySelector('#btn-settings-wrench');

    this._wrenchBtn.addEventListener('click', () => {
      this._onOpenRescue();
    });
  }

  /** @private */
  _setupSubscriptions() {
    const unsubEntity = this._bus.on(Topics.HA_ENTITY_UPDATED, (data) => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (data.role === 'temperature') {
        let tempNum = parseFloat(data.state);
        if (isNaN(tempNum) && data.attributes) {
          if (data.attributes.current_temperature !== undefined && data.attributes.current_temperature !== null) {
            tempNum = parseFloat(data.attributes.current_temperature);
          } else if (data.attributes.temperature !== undefined && data.attributes.temperature !== null) {
            tempNum = parseFloat(data.attributes.temperature);
          }
        }
        const tempText = !isNaN(tempNum) ? tempNum.toFixed(1) : data.state;
        this._currentTemp = tempText;
        this._writeCachedTemp(tempText);
        if (this._tempValueEl) {
          const formatted = `${this._tempLabel}: ${tempText}°C`;
          if (this._tempValueEl.textContent !== formatted) {
            this._tempValueEl.textContent = formatted;
          }
        }
      }
    });

    this._unsubscribers.push(unsubEntity);
  }

  /** @private */
  _escape(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}
