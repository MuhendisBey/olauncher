import { APP_VERSION } from '../core/Version.js';

/**
 * Compact modal dialog for Samsung Smart Hub fallback and Rescue triggers.
 */
export class RescueModal {
  /**
   * @param {{
   *   container: HTMLElement,
   *   locale: typeof import('../i18n/tr.js').tr,
   *   onSelectSmartHub: () => void,
   *   onSelectRescue: () => void,
   *   onSelectReload: () => void,
   *   onClose: () => void
   * }} deps
   */
  constructor({ container, locale, onSelectSmartHub, onSelectRescue, onSelectReload, onClose }) {
    this._container = container;
    this._locale = locale;
    this._onSelectSmartHub = onSelectSmartHub;
    this._onSelectRescue = onSelectRescue;
    this._onSelectReload = onSelectReload;
    this._onClose = onClose;
  }

  show() {
    this._container.innerHTML = `
      <div class="modal-backdrop" data-action="close"></div>
      <div class="modal-dialog rescue-dialog" role="dialog" aria-modal="true">
        <div class="modal-header">
          <div class="modal-header-row">
            <h2 class="modal-title">${this._locale.ui.rescueTitle}</h2>
            <span class="modal-counter-badge">v${APP_VERSION}</span>
          </div>
          <p class="modal-subtitle">${this._locale.ui.rescueSubtitle}</p>
        </div>
        <div class="modal-body">
          <button type="button" class="modal-item focusable" id="opt-smart-hub" tabindex="-1">
            <span class="modal-item-title">${this._locale.ui.rescueActions.smartHub.title}</span>
            <span class="modal-item-desc">${this._locale.ui.rescueActions.smartHub.description}</span>
          </button>
          <button type="button" class="modal-item focusable" id="opt-rescue-reset" tabindex="-1">
            <span class="modal-item-title">${this._locale.ui.rescueActions.rescue.title}</span>
            <span class="modal-item-desc">${this._locale.ui.rescueActions.rescue.description}</span>
          </button>
          <button type="button" class="modal-item focusable" id="opt-reload" tabindex="-1">
            <span class="modal-item-title">${this._locale.ui.rescueActions.reload.title}</span>
            <span class="modal-item-desc">${this._locale.ui.rescueActions.reload.description}</span>
          </button>
        </div>
        <div class="modal-footer">
          <button type="button" class="modal-close-btn focusable" data-action="close" tabindex="-1">Kapat (Geri)</button>
        </div>
      </div>
    `;

    this._container.classList.remove('hidden');

    this._container.querySelector('#opt-smart-hub').addEventListener('click', () => {
      this.hide();
      this._onSelectSmartHub();
    });

    this._container.querySelector('#opt-rescue-reset').addEventListener('click', () => {
      this.hide();
      this._onSelectRescue();
    });

    this._container.querySelector('#opt-reload').addEventListener('click', () => {
      this.hide();
      this._onSelectReload();
    });

    this._container.querySelectorAll('[data-action="close"]').forEach((el) => {
      el.addEventListener('click', () => this.hide());
    });
  }

  hide() {
    this._container.classList.add('hidden');
    this._container.innerHTML = '';
    this._onClose();
  }
}
