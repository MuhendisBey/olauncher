import { AudioChime } from './AudioChime.js';
import { KeyCodes } from '../input/KeyCodes.js';

/**
 * Cinematic startup / boot screen overlay.
 * Orchestrates a 3-phase bespoke family welcome sequence with zero GPU overhead.
 */
export class BootAnimation {
  /**
   * @param {{
   *   container: HTMLElement,
   *   config?: { enabled?: boolean, sound?: boolean, durationMs?: number, title?: string, subtitle?: string },
   *   locale: typeof import('../i18n/tr.js').tr,
   *   familyName?: string,
   *   logger?: import('../core/Logger.js').Logger,
   *   onComplete?: () => void
   * }} options
   */
  constructor({ container, config = {}, locale, familyName = 'Gürsoy Ailesi', logger, onComplete }) {
    this._container = container;
    this._config = {
      enabled: config.enabled !== false,
      sound: config.sound !== false,
      title: config.title || 'G Ü R S O Y',
      subtitle: config.subtitle || 'SMART CINEMA • 4K HDR',
      ...config,
      durationMs: Math.max(config.durationMs || config.duration_ms || 6200, 6000)
    };
    this._locale = locale;
    this._familyName = familyName;
    this._logger = logger;
    this._onComplete = onComplete;

    this._chime = new AudioChime({ enabled: this._config.sound });
    this._overlayEl = null;
    this._isDismissed = false;
    this._timers = [];
    this._startTime = 0;
    this._boundOnKey = this._onKey.bind(this);
  }

  /**
   * Starts the boot animation sequence.
   */
  start() {
    this._overlayEl = document.getElementById('boot-overlay');

    if (!this._config.enabled) {
      if (this._overlayEl) this._overlayEl.style.display = 'none';
      const stage = document.getElementById('stage');
      if (stage) stage.classList.add('stage-ready');
      if (this._onComplete) this._onComplete();
      return;
    }

    this._startTime = Date.now();
    this._render();
    this._bindEvents();

    // Phase 1: Immediate Audio Chime + Beam Expansion & Wordmark shimmer
    requestAnimationFrame(() => {
      if (this._overlayEl) {
        this._overlayEl.classList.add('phase-1');
      }
      this._chime.play();
    });

    // Phase 2: Family Greeting & 4K Subtitle reveal (650ms)
    this._schedule(() => {
      if (this._isDismissed || !this._overlayEl) return;
      this._overlayEl.classList.add('phase-2');
    }, 650);

    // Phase 3: Transition to main launcher stage (default ~3800ms)
    this._schedule(() => {
      this._finish(false);
    }, this._config.durationMs);
  }

  /**
   * Instantly skips the boot animation on deliberate user input (remote keypress).
   */
  skip() {
    if (this._isDismissed) return;
    if (this._logger) this._logger.info('Boot animation dismissed by remote key');
    this._finish(true);
  }

  /** @private */
  _render() {
    const greetingText = this._resolveGreeting();

    if (this._overlayEl) {
      this._overlayEl.style.display = 'flex';

      // Update dynamic elements smoothly without destroying CSS animation state
      const greetingEl = this._overlayEl.querySelector('#boot-greeting');
      if (greetingEl) {
        greetingEl.innerHTML = `${this._escape(greetingText)}, <strong>${this._escape(this._familyName)}</strong> <span class="boot-sparkle">✨</span>`;
      }

      const titleEl = this._overlayEl.querySelector('#boot-title');
      if (titleEl && this._config.title) {
        titleEl.textContent = this._config.title;
      }

      const subtitleEl = this._overlayEl.querySelector('#boot-subtitle');
      if (subtitleEl && this._config.subtitle) {
        subtitleEl.textContent = this._config.subtitle;
      }
      return;
    }

    // Fallback if not already in index.html
    this._overlayEl = document.createElement('div');
    this._overlayEl.id = 'boot-overlay';
    this._overlayEl.className = 'boot-overlay phase-1';
    this._overlayEl.innerHTML = `
      <div class="boot-backdrop"></div>
      <div class="boot-art" id="boot-stage">
        <img src="assets/gursoy_boot_cinematic.jpg" class="boot-layer boot-layer-full" alt="Gürsoy Ailesi Amblemi" />
        <img src="assets/gursoy_boot_cinematic.jpg" class="boot-layer boot-layer-star-top" alt="" />
        <img src="assets/gursoy_boot_cinematic.jpg" class="boot-layer boot-layer-star-left" alt="" />
        <img src="assets/gursoy_boot_cinematic.jpg" class="boot-layer boot-layer-star-right" alt="" />
        <img src="assets/gursoy_boot_cinematic.jpg" class="boot-layer boot-layer-g" alt="" />
        <span class="boot-flare boot-flare-top"></span>
        <span class="boot-flare boot-flare-left"></span>
        <span class="boot-flare boot-flare-right"></span>
        <span class="boot-flare boot-flare-g"></span>
        <span class="boot-flare boot-flare-rings"></span>
      </div>
      <div class="boot-greeting-row">
        <div class="boot-greeting" id="boot-greeting">${this._escape(greetingText)}, <strong>${this._escape(this._familyName)}</strong> <span class="boot-sparkle">✨</span></div>
      </div>
    `;
    this._container.appendChild(this._overlayEl);
  }

  /** @private */
  _resolveGreeting() {
    const hour = new Date().getHours();
    let matched = 'İyi günler';
    if (this._locale?.greetings) {
      for (const g of this._locale.greetings) {
        if (hour >= g.fromHour) {
          matched = g.text;
        }
      }
    } else {
      if (hour >= 5 && hour < 12) matched = 'Günaydın';
      else if (hour >= 12 && hour < 18) matched = 'İyi günler';
      else if (hour >= 18 && hour < 23) matched = 'İyi akşamlar';
      else matched = 'İyi geceler';
    }
    return matched;
  }

  /** @private */
  _bindEvents() {
    // Only listen to physical key events (NO mouse/synthetic clicks that Tizen dispatches at launch)
    window.addEventListener('keydown', this._boundOnKey, { capture: true });
  }

  /** @private */
  _unbindEvents() {
    window.removeEventListener('keydown', this._boundOnKey, { capture: true });
  }

  /**
   * @private
   * @param {KeyboardEvent} ev
   */
  _onKey(ev) {
    // Protection 1: Enforce minimum display time (1200ms) to ignore the remote button press that launched the app
    if (Date.now() - this._startTime < 1200) {
      return;
    }

    // Protection 2: Only deliberate remote navigation keys trigger skip
    const isNavigationKey = (
      ev.keyCode === KeyCodes.ENTER ||
      ev.keyCode === KeyCodes.LEFT ||
      ev.keyCode === KeyCodes.RIGHT ||
      ev.keyCode === KeyCodes.UP ||
      ev.keyCode === KeyCodes.DOWN ||
      ev.keyCode === KeyCodes.TIZEN_BACK ||
      ev.keyCode === KeyCodes.ESCAPE ||
      ev.keyCode === KeyCodes.BACKSPACE ||
      ev.key === 'Enter'
    );

    if (isNavigationKey) {
      this.skip();
    }
  }

  /** @private */
  _schedule(fn, delayMs) {
    const tid = setTimeout(fn, delayMs);
    this._timers.push(tid);
  }

  /**
   * @private
   * @param {boolean} [fast=false]
   */
  _finish(fast = false) {
    if (this._isDismissed) return;
    this._isDismissed = true;
    this._unbindEvents();
    this._timers.forEach((t) => clearTimeout(t));
    this._timers = [];

    // Trigger launcher stage entrance cascade
    const stage = document.getElementById('stage');
    if (stage) {
      stage.classList.add('stage-ready');
    }

    if (!this._overlayEl) {
      if (this._onComplete) this._onComplete();
      return;
    }

    if (fast) {
      this._overlayEl.classList.add('phase-fast-dismiss');
    } else {
      this._overlayEl.classList.add('phase-exit');
    }

    const fadeMs = fast ? 150 : 600;
    setTimeout(() => {
      if (this._overlayEl) {
        this._overlayEl.style.display = 'none';
        this._overlayEl.setAttribute('aria-hidden', 'true');
      }
      if (this._onComplete) {
        this._onComplete();
      }
    }, fadeMs);
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
