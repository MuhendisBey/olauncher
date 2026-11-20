/**
 * Grid view modal showing all installed visible TV applications.
 * Features real app icons, visual scroll slider, and active position counter.
 */
export class AllAppsModal {
  /**
   * @param {{
   *   container: HTMLElement,
   *   locale: typeof import('../i18n/tr.js').tr,
   *   onLaunchApp: (appId: string) => void,
   *   onClose: () => void
   * }} deps
   */
  constructor({ container, locale, onLaunchApp, onClose }) {
    this._container = container;
    this._locale = locale;
    this._onLaunchApp = onLaunchApp;
    this._onClose = onClose;
    this._cleanupHandlers = [];
    this._sliderTimer = null;
  }

  /**
   * @param {Array<{ id: string, name: string, iconPath?: string }>} apps
   */
  show(apps) {
    this._cleanup();
    const totalCount = apps.length;
    const listHtml = apps.map((a, idx) => {
      const initial = (a.name || '?')[0].toUpperCase();
      const iconHtml = a.iconPath
        ? `<img class="grid-app-img" src="${this._escape(a.iconPath)}" alt="${this._escape(a.name)}" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" />
           <span class="grid-app-fallback" style="display:none;">${initial}</span>`
        : `<span class="grid-app-fallback">${initial}</span>`;

      return `
        <button type="button" class="grid-app-item focusable" data-app-id="${a.id}" data-index="${idx}" tabindex="-1">
          <div class="grid-app-icon">${iconHtml}</div>
          <div class="grid-app-name">${this._escape(a.name)}</div>
          <div class="grid-app-id">${this._escape(a.id)}</div>
        </button>
      `;
    }).join('');

    this._container.innerHTML = `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-dialog all-apps-dialog" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-header-row">
            <h2 class="modal-title">${this._locale.ui.allAppsHeading}</h2>
            <div class="modal-counter-badge" id="modal-apps-counter">${totalCount > 0 ? `1 / ${totalCount} Uygulama` : '0 Uygulama'}</div>
          </div>
          <p class="modal-subtitle">${this._locale.ui.allAppsHint}</p>
        </div>
        <div class="modal-grid-wrapper">
          <div class="modal-grid-body" id="modal-grid-body">
            ${listHtml || `<div class="empty-state">${this._locale.ui.loadingApps}</div>`}
          </div>
          <div class="modal-slider-track" id="modal-slider-track">
            <div class="modal-slider-thumb" id="modal-slider-thumb"></div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="modal-close-btn focusable" data-action="close" tabindex="-1">Kapat (Geri)</button>
        </div>
      </div>
    `;

    this._container.classList.remove('hidden');

    const gridBody = this._container.querySelector('#modal-grid-body');
    const sliderThumb = this._container.querySelector('#modal-slider-thumb');
    const sliderTrack = this._container.querySelector('#modal-slider-track');
    const counterBadge = this._container.querySelector('#modal-apps-counter');

    const updateSlider = () => {
      if (!gridBody || !sliderThumb || !sliderTrack) return;
      const maxScroll = gridBody.scrollHeight - gridBody.clientHeight;
      const trackHeight = sliderTrack.clientHeight || 800;
      if (maxScroll <= 5) {
        sliderThumb.style.display = 'none';
        return;
      }
      sliderThumb.style.display = 'block';
      const pct = Math.max(0, Math.min(1, gridBody.scrollTop / maxScroll));
      const thumbHeight = Math.max(80, (gridBody.clientHeight / gridBody.scrollHeight) * trackHeight);
      sliderThumb.style.height = `${thumbHeight}px`;
      sliderThumb.style.top = `${pct * (trackHeight - thumbHeight)}px`;
    };

    if (gridBody) {
      gridBody.addEventListener('scroll', updateSlider, { passive: true });
      this._cleanupHandlers.push(() => gridBody.removeEventListener('scroll', updateSlider));
    }

    this._container.querySelectorAll('.grid-app-item').forEach((btn) => {
      const onFocus = () => {
        const idx = Number(btn.getAttribute('data-index') || 0);
        if (counterBadge) {
          counterBadge.textContent = `${idx + 1} / ${totalCount} Uygulama`;
        }
        updateSlider();
      };
      const onClick = (e) => {
        const appId = e.currentTarget.getAttribute('data-app-id');
        this.hide();
        this._onLaunchApp(appId);
      };

      btn.addEventListener('navfocus', onFocus);
      btn.addEventListener('click', onClick);
      this._cleanupHandlers.push(() => {
        btn.removeEventListener('navfocus', onFocus);
        btn.removeEventListener('click', onClick);
      });
    });

    this._container.querySelectorAll('[data-action="close"]').forEach((el) => {
      const onCloseClick = () => this.hide();
      el.addEventListener('click', onCloseClick);
      this._cleanupHandlers.push(() => el.removeEventListener('click', onCloseClick));
    });

    this._sliderTimer = setTimeout(updateSlider, 50);
  }

  close() {
    this.hide();
  }

  hide() {
    this._cleanup();
    this._container.classList.add('hidden');
    this._container.innerHTML = '';
    this._onClose();
  }

  /** @private */
  _cleanup() {
    if (this._sliderTimer) {
      clearTimeout(this._sliderTimer);
      this._sliderTimer = null;
    }
    this._cleanupHandlers.forEach((fn) => {
      try { fn(); } catch (_) {}
    });
    this._cleanupHandlers = [];
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
