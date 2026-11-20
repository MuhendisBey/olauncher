import { tr } from './tr.js';

/** Registered locale packs. Add a pack here to support another language (Open/Closed). */
const LOCALES = Object.freeze({ tr });

const DEFAULT_LOCALE = 'tr';

/**
 * @param {string} [code] e.g. "tr" or "tr-TR"
 * @returns {typeof tr}
 */
export function resolveLocale(code) {
  const key = String(code || DEFAULT_LOCALE).toLowerCase().split('-')[0];
  return LOCALES[key] || LOCALES[DEFAULT_LOCALE];
}
