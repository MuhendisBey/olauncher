/**
 * Samsung Tizen Remote & Keyboard Key Code mappings.
 */
export const KeyCodes = Object.freeze({
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  // Tizen hardware Return/Back key
  TIZEN_BACK: 10009,
  // Browser fallback keys
  ESCAPE: 27,
  BACKSPACE: 8,

  // Remote Color Keys
  COLOR_RED: 403,
  COLOR_GREEN: 404,
  COLOR_YELLOW: 405,
  COLOR_BLUE: 406,

  // Media Keys
  MEDIA_PLAY: 415,
  MEDIA_PAUSE: 19,
  MEDIA_PLAY_PAUSE: 10252,
  MEDIA_STOP: 413
});

/**
 * Checks if a key event corresponds to "Back" action.
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isBackKey(ev) {
  return (
    ev.keyCode === KeyCodes.TIZEN_BACK ||
    ev.keyCode === KeyCodes.ESCAPE ||
    (ev.keyCode === KeyCodes.BACKSPACE && !isEditableTarget(ev.target))
  );
}

/**
 * Checks if a key event corresponds to "Enter/Select" action.
 * @param {KeyboardEvent} ev
 * @returns {boolean}
 */
export function isEnterKey(ev) {
  return ev.keyCode === KeyCodes.ENTER || ev.key === 'Enter';
}

function isEditableTarget(target) {
  return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
}
