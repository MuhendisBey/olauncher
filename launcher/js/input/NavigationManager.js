import { KeyCodes, isBackKey, isEnterKey } from './KeyCodes.js';

/**
 * Spatial Navigation Manager for 10-foot TV Remote experience.
 *
 * Uses pure virtual CSS focus (.is-focused) without native HTMLElement.focus()/blur()
 * so Tizen's chromium-efl Ewk_View never emits native focus, IME, or spatial-pointer
 * events to the Enlightenment Wayland compositor.
 */
export class NavigationManager {
  /**
   * @param {{ logger: import('../core/Logger.js').Logger, onActivity?: () => void }} deps
   */
  constructor({ logger, onActivity }) {
    this._logger = logger.child('NavigationManager');
    this._onActivity = typeof onActivity === 'function' ? onActivity : null;
    /** @type {HTMLElement|null} */
    this._currentFocus = null;
    /** @type {HTMLElement|null} */
    this._modalContainer = null;
    /** @type {HTMLElement|null} */
    this._savedFocusBeforeModal = null;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
  }

  /**
   * Attaches window key listeners.
   */
  init() {
    window.addEventListener('keydown', this._onKeyDown, true);
    window.addEventListener('keyup', this._onKeyUp, true);
    this._logger.info('NavigationManager initialized');
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown, true);
    window.removeEventListener('keyup', this._onKeyUp, true);
  }

  /**
   * @returns {HTMLElement|null}
   */
  getCurrentFocus() {
    return this._currentFocus;
  }

  /**
   * Releases any accidental native browser focus from activeElement.
   */
  blurNativeFocus() {
    try {
      const active = document.activeElement;
      if (active && active !== document.body && active !== document.documentElement && typeof active.blur === 'function') {
        active.blur();
      }
    } catch (_) {}
  }

  /**
   * Explicitly sets virtual focus (.is-focused) to a focusable element.
   * @param {HTMLElement|null} element
   */
  setFocus(element) {
    if (!element || !element.classList.contains('focusable')) return;

    if (this._currentFocus && this._currentFocus !== element) {
      this._currentFocus.classList.remove('is-focused');
    }

    this._currentFocus = element;
    element.classList.add('is-focused');
    this.blurNativeFocus();

    // Synchronous zero-timer scroll reveal inside active modal grid
    if (this._modalContainer) {
      const scrollBox = element.closest('.modal-grid-body');
      if (scrollBox && scrollBox.scrollHeight > scrollBox.clientHeight) {
        const boxRect = scrollBox.getBoundingClientRect();
        const itemRect = element.getBoundingClientRect();
        const gutter = 16;
        if (itemRect.top < boxRect.top + gutter) {
          scrollBox.scrollTop -= (boxRect.top + gutter - itemRect.top);
        } else if (itemRect.bottom > boxRect.bottom - gutter) {
          scrollBox.scrollTop += (itemRect.bottom - (boxRect.bottom - gutter));
        }
      }
    }

    try {
      element.dispatchEvent(new CustomEvent('navfocus'));
    } catch (_) {}
  }

  /**
   * Enters modal trap mode.
   * @param {HTMLElement} modalEl
   * @param {HTMLElement} [initialFocusEl]
   */
  openModal(modalEl, initialFocusEl) {
    this._savedFocusBeforeModal = this._currentFocus;
    this._modalContainer = modalEl;

    const target = initialFocusEl || modalEl.querySelector('.focusable');
    if (target) {
      this.setFocus(target);
    }
  }

  /**
   * Closes modal trap mode and restores previous focus.
   */
  closeModal() {
    this._modalContainer = null;
    if (this._savedFocusBeforeModal && document.body.contains(this._savedFocusBeforeModal)) {
      this.setFocus(this._savedFocusBeforeModal);
    } else {
      this.focusDefault();
    }
    this._savedFocusBeforeModal = null;
  }

  /**
   * Focuses a card by data-id if present, otherwise the first visible card in the apps row.
   * @param {string} [preferredId]
   */
  focusDefault(preferredId) {
    if (preferredId) {
      const candidates = document.querySelectorAll('.apps-rail .focusable');
      for (let i = 0; i < candidates.length; i++) {
        if (candidates[i].getAttribute('data-id') === preferredId) {
          this.setFocus(candidates[i]);
          return;
        }
      }
    }
    const firstCard = document.querySelector('.apps-rail .focusable');
    if (firstCard) {
      this.setFocus(firstCard);
    }
  }

  /** @private */
  _onKeyDown(ev) {
    if (document.hidden) return;
    if (this._onActivity) this._onActivity();

    if (isBackKey(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!ev.repeat) {
        this._handleBack();
      }
      return;
    }

    if (isEnterKey(ev)) {
      ev.preventDefault();
      if (!ev.repeat) {
        this._handleEnter();
      }
      return;
    }

    let direction = null;
    if (ev.keyCode === KeyCodes.LEFT) direction = 'left';
    else if (ev.keyCode === KeyCodes.RIGHT) direction = 'right';
    else if (ev.keyCode === KeyCodes.UP) direction = 'up';
    else if (ev.keyCode === KeyCodes.DOWN) direction = 'down';

    if (direction) {
      ev.preventDefault();
      this._navigate(direction);
    }
  }

  /** @private */
  _onKeyUp(ev) {
    if (document.hidden) return;
    if (this._onActivity) this._onActivity();
    if (isBackKey(ev)) {
      ev.preventDefault();
      ev.stopImmediatePropagation();
    }
  }

  /** @private */
  _handleEnter() {
    if (this._currentFocus) {
      this._currentFocus.click();
    }
  }

  /** @private */
  _handleBack() {
    if (this._modalContainer) {
      const closeBtn = this._modalContainer.querySelector('[data-action="close"]');
      if (closeBtn) closeBtn.click();
      else this.closeModal();
    }
  }

  /** @private */
  _navigate(direction) {
    const root = this._modalContainer || document;
    const focusables = Array.from(root.querySelectorAll('.focusable')).filter((el) => {
      return el.offsetParent !== null && !el.hasAttribute('disabled');
    });

    if (focusables.length === 0) return;

    if (!this._currentFocus || !root.contains(this._currentFocus)) {
      this.setFocus(focusables[0]);
      return;
    }

    // Modal navigation: grid-aware or vertical stepping
    if (this._modalContainer) {
      this._navigateModal(focusables, direction);
      return;
    }

    // Main screen spatial navigation
    this._navigateSpatial(focusables, direction);
  }

  /** @private */
  _navigateModal(focusables, direction) {
    const gridBody = this._modalContainer.querySelector('.modal-grid-body');
    if (gridBody && gridBody.contains(this._currentFocus)) {
      const gridItems = Array.from(gridBody.querySelectorAll('.grid-app-item'));
      const idx = gridItems.indexOf(this._currentFocus);
      const cols = 4; // 4-column grid layout

      if (direction === 'right') {
        if (idx + 1 < gridItems.length) {
          this.setFocus(gridItems[idx + 1]);
        }
      } else if (direction === 'left') {
        if (idx - 1 >= 0) {
          this.setFocus(gridItems[idx - 1]);
        }
      } else if (direction === 'down') {
        const nextRowIdx = idx + cols;
        if (nextRowIdx < gridItems.length) {
          this.setFocus(gridItems[nextRowIdx]);
        } else {
          // Reached bottom of grid, jump to modal close button
          const closeBtn = this._modalContainer.querySelector('.modal-close-btn');
          if (closeBtn) this.setFocus(closeBtn);
        }
      } else if (direction === 'up') {
        const prevRowIdx = idx - cols;
        if (prevRowIdx >= 0) {
          this.setFocus(gridItems[prevRowIdx]);
        }
      }
      return;
    }

    // If focused on modal close button
    if (this._currentFocus.classList.contains('modal-close-btn')) {
      if (direction === 'up') {
        const gridItems = Array.from(this._modalContainer.querySelectorAll('.grid-app-item'));
        if (gridItems.length > 0) {
          this.setFocus(gridItems[gridItems.length - 1]);
          return;
        }
      }
    }

    // Standard 1D vertical list navigation (RescueModal)
    this._navigateList(focusables, direction);
  }

  /** @private */
  _navigateList(focusables, direction) {
    const idx = focusables.indexOf(this._currentFocus);
    if (idx === -1) {
      this.setFocus(focusables[0]);
      return;
    }

    if (direction === 'down' || direction === 'right') {
      const next = focusables[(idx + 1) % focusables.length];
      this.setFocus(next);
    } else if (direction === 'up' || direction === 'left') {
      const prev = focusables[(idx - 1 + focusables.length) % focusables.length];
      this.setFocus(prev);
    }
  }

  /** @private */
  _navigateSpatial(focusables, direction) {
    const currentRect = this._currentFocus.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestCandidate = null;
    let minDistance = Infinity;

    focusables.forEach((el) => {
      if (el === this._currentFocus) return;

      const rect = el.getBoundingClientRect();
      const center = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      };

      const dx = center.x - currentCenter.x;
      const dy = center.y - currentCenter.y;

      let isValidDirection = false;
      let primaryDist = 0;
      let secondaryDist = 0;

      switch (direction) {
        case 'left':
          isValidDirection = dx < -10;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
          break;
        case 'right':
          isValidDirection = dx > 10;
          primaryDist = Math.abs(dx);
          secondaryDist = Math.abs(dy);
          break;
        case 'up':
          isValidDirection = dy < -10;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
          break;
        case 'down':
          isValidDirection = dy > 10;
          primaryDist = Math.abs(dy);
          secondaryDist = Math.abs(dx);
          break;
      }

      if (isValidDirection) {
        // Bias distance to strongly prefer elements aligned on the secondary axis
        const weightedDist = primaryDist + secondaryDist * 2.5;
        if (weightedDist < minDistance) {
          minDistance = weightedDist;
          bestCandidate = el;
        }
      }
    });

    if (bestCandidate) {
      this.setFocus(bestCandidate);
    }
  }
}
