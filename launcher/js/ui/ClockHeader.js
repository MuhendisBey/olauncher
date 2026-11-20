/**
 * Updates top-left clock, Turkish date and greeting message.
 * Uses minute-aligned single-shot timers instead of 1000ms polling.
 */
export class ClockHeader {
  /**
   * @param {{
   *   container: HTMLElement,
   *   locale: typeof import('../i18n/tr.js').tr,
   *   familyName: string
   * }} deps
   */
  constructor({ container, locale, familyName }) {
    this._container = container;
    this._locale = locale;
    this._familyName = familyName || 'Gürsoy Ailesi';
    this._timer = null;
    this._isPaused = false;
  }

  start() {
    this._isPaused = false;
    this._render();
    this._tick();
  }

  destroy() {
    this.pause();
  }

  pause() {
    this._isPaused = true;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  resume() {
    this.pause();
    if (typeof document !== 'undefined' && document.hidden) return;
    this._isPaused = false;
    this._tick();
  }

  /** @private */
  _tick() {
    if (this._isPaused || (typeof document !== 'undefined' && document.hidden)) return;
    this._update();
    const msToNextMinute = 60000 - (Date.now() % 60000) + 50;
    this._timer = setTimeout(() => {
      this._timer = null;
      this._tick();
    }, msToNextMinute);
  }

  /** @private */
  _render() {
    this._container.innerHTML = `
      <div class="clock-left-block">
        <div class="clock-time" id="clock-time">--:--</div>
        <div class="clock-date" id="clock-date">-- --- -------</div>
      </div>
      <div class="clock-divider"></div>
      <div class="greeting-block">
        <div class="greeting-greeting" id="greeting-greeting">İyi günler,</div>
        <div class="greeting-family">${this._escape(this._familyName)} <span class="sparkle">✨</span></div>
      </div>
    `;

    this._timeEl = this._container.querySelector('#clock-time');
    this._dateEl = this._container.querySelector('#clock-date');
    this._greetingEl = this._container.querySelector('#greeting-greeting');
  }

  /** @private */
  _update() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}`;

    if (this._timeEl && this._timeEl.textContent !== timeStr) {
      this._timeEl.textContent = timeStr;
    }

    const day = now.getDate();
    const month = this._locale.calendar.months[now.getMonth()];
    const weekday = this._locale.calendar.weekdays[now.getDay()];
    const dateStr = this._locale.calendar.longDate({ day, month, weekday });

    if (this._dateEl && this._dateEl.textContent !== dateStr) {
      this._dateEl.textContent = dateStr;
    }

    const currentHour = now.getHours();
    let matchedGreeting = 'İyi günler';
    for (const g of this._locale.greetings) {
      if (currentHour >= g.fromHour) {
        matchedGreeting = g.text;
      }
    }

    const greetingStr = `${matchedGreeting},`;
    if (this._greetingEl && this._greetingEl.textContent !== greetingStr) {
      this._greetingEl.textContent = greetingStr;
    }
  }

  /** @private */
  _escape(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}
