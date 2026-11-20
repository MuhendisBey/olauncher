import { DEFAULT_CONFIG } from './defaultConfig.js';
import { camelizeKeys, deepFreeze, deepMerge, validateConfig } from './configSchema.js';

/**
 * Produces the immutable runtime configuration.
 * Failure policy: a missing or broken config.json is logged and the built-in
 * defaults are used — the launcher must never block boot on configuration.
 */
export class ConfigLoader {
  /**
   * @param {{ transport: { get(url: string): Promise<any> }, logger: import('../core/Logger.js').Logger }} deps
   */
  constructor({ transport, logger }) {
    this._transport = transport;
    this._logger = logger;
  }

  /**
   * @param {string} url
   * @returns {Promise<Readonly<typeof DEFAULT_CONFIG>>}
   */
  async load(url) {
    let raw = {};
    try {
      raw = await this._transport.get(url);
    } catch (error) {
      this._logger.warn('config.json yüklenemedi, varsayılanlar kullanılıyor:', error.message);
    }

    const merged = deepMerge(DEFAULT_CONFIG, camelizeKeys(raw));
    const { config, warnings } = validateConfig(merged);
    warnings.forEach((w) => this._logger.warn(w));
    return deepFreeze(config);
  }
}
