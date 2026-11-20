import { Topics } from '../core/Topics.js';

/**
 * Lightweight on-screen toast notification manager.
 */
export class ToastManager {
  /**
   * @param {{ container: HTMLElement, eventBus: import('../core/EventBus.js').EventBus }} deps
   */
  constructor({ container, eventBus }) {
    this._container = container;
    this._bus = eventBus;
    this._timer = null;
    this._fadeTimer = null;
  }

  init() {
    this._bus.on(Topics.TOAST, ({ message, durationMs = 3000 }) => {
      this.show(message, durationMs);
    });
  }

  /**
   * Immediately cancels any pending toast timers and hides the overlay.
   */
  clear() {
    clearTimeout(this._timer);
    clearTimeout(this._fadeTimer);
    this._timer = null;
    this._fadeTimer = null;
    if (this._container) {
      this._container.classList.remove('visible', 'fade-out');
      this._container.classList.add('hidden');
    }
  }

  /**
   * @param {string} message
   * @param {number} [durationMs]
   */
  show(message, durationMs = 3000) {
    if (typeof document !== 'undefined' && document.hidden) return;
    clearTimeout(this._timer);
    clearTimeout(this._fadeTimer);

    this._container.textContent = message;
    this._container.classList.remove('hidden', 'fade-out');
    this._container.classList.add('visible');

    this._timer = setTimeout(() => {
      this._timer = null;
      if (typeof document !== 'undefined' && document.hidden) {
        this.clear();
        return;
      }
      this._container.classList.add('fade-out');
      this._fadeTimer = setTimeout(() => {
        this._fadeTimer = null;
        this._container.classList.remove('visible', 'fade-out');
        this._container.classList.add('hidden');
      }, 400);
    }, durationMs);
  }
}
