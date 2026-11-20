import { Icons } from './Icons.js';

/**
 * Factory & Strategy pattern for creating application cards on the home rail.
 */
export class AppCardFactory {
  /**
   * Creates a card element for an HDMI input.
   * @param {{ id: string, label: string, sourceType: string, sourceNumber: number, theme?: string }} input
   * @param {(input: any) => void} onSelect
   * @returns {HTMLElement}
   */
  static createInputCard(input, onSelect) {
    const card = document.createElement('div');
    const safeTheme = this._safeClass(input.theme || 'generic');
    card.className = `app-card focusable card-${safeTheme}`;
    card.setAttribute('role', 'button');
    card.setAttribute('data-id', input.id);
    card.setAttribute('aria-label', input.label);

    const iconHtml = input.theme === 'xbox' ? Icons.XBOX : Icons.GLOBE;
    card.innerHTML = `
      <div class="card-inner">
        <div class="card-visual">${iconHtml}</div>
        <div class="card-label">${this._escape(input.label)}</div>
      </div>
    `;

    card.addEventListener('click', () => onSelect(input));
    return card;
  }

  /**
   * Creates a card for the Web Browser.
   * @param {string} label
   * @param {() => void} onSelect
   * @returns {HTMLElement}
   */
  static createBrowserCard(label, onSelect) {
    const card = document.createElement('div');
    card.className = 'app-card focusable card-browser';
    card.setAttribute('role', 'button');
    card.setAttribute('data-id', 'browser');
    card.setAttribute('aria-label', label);

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-visual">${Icons.GLOBE}</div>
        <div class="card-label">${this._escape(label)}</div>
      </div>
    `;

    card.addEventListener('click', onSelect);
    return card;
  }

  /**
   * Creates a branded consumer streaming app card.
   * @param {{ id: string, label: string }} app
   * @param {() => void} onSelect
   * @returns {HTMLElement}
   */
  static createAppCard(app, onSelect) {
    const card = document.createElement('div');
    const theme = this._resolveTheme(app.id, app.label);
    card.className = `app-card focusable card-${theme}`;
    card.setAttribute('role', 'button');
    card.setAttribute('data-id', app.id);
    card.setAttribute('aria-label', app.label);

    const visualHtml = this._resolveVisual(theme, app.label);

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-visual">${visualHtml}</div>
        ${theme === 'netflix' || theme === 'prime' || theme === 'disney' || theme === 'stremio' ? '' : `<div class="card-label">${this._escape(app.label)}</div>`}
      </div>
    `;

    card.addEventListener('click', onSelect);
    return card;
  }

  /**
   * Creates the "DİĞER UYGULAMALAR" (All Apps) card.
   * @param {string} label
   * @param {() => void} onSelect
   * @returns {HTMLElement}
   */
  static createMoreAppsCard(label, onSelect) {
    const card = document.createElement('div');
    card.className = 'app-card focusable card-more-apps';
    card.setAttribute('role', 'button');
    card.setAttribute('data-id', 'all-apps');
    card.setAttribute('aria-label', label);

    card.innerHTML = `
      <div class="card-inner">
        <div class="card-visual">${Icons.GRID}</div>
        <div class="card-label">${this._escape(label)}</div>
      </div>
    `;

    card.addEventListener('click', onSelect);
    return card;
  }

  /** @private */
  static _resolveTheme(appId, label) {
    const s = `${appId} ${label}`.toLowerCase();
    if (s.includes('netflix')) return 'netflix';
    if (s.includes('prime') || s.includes('amazon')) return 'prime';
    if (s.includes('disney')) return 'disney';
    if (s.includes('spotify')) return 'spotify';
    if (s.includes('youtube')) return 'youtube';
    if (s.includes('stremio') || s.includes('streamio')) return 'stremio';
    if (s.includes('apple')) return 'appletv';
    return 'generic';
  }

  /** @private */
  static _resolveVisual(theme, label) {
    switch (theme) {
      case 'netflix':
        return Icons.NETFLIX;
      case 'prime':
        return Icons.PRIME_VIDEO;
      case 'disney':
        return Icons.DISNEY_PLUS;
      case 'spotify':
        return Icons.SPOTIFY;
      case 'youtube':
        return Icons.YOUTUBE;
      case 'stremio':
        return Icons.STREMIO;
      default:
        return `<span class="generic-initial">${this._escape((label || '?')[0].toUpperCase())}</span>`;
    }
  }

  /** @private */
  static _safeClass(str) {
    return String(str || 'generic').toLowerCase().replace(/[^a-z0-9-]/g, '') || 'generic';
  }

  /** @private */
  static _escape(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
}
