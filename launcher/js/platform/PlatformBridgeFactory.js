import { BrowserMockBridge } from './BrowserMockBridge.js';
import { TizenNativeBridge } from './TizenNativeBridge.js';

/**
 * Factory for creating the appropriate platform bridge instance.
 */
export class PlatformBridgeFactory {
  /**
   * @param {{ eventBus: import('../core/EventBus.js').EventBus, logger: import('../core/Logger.js').Logger }} deps
   * @returns {import('./ITizenBridge.js').ITizenBridge}
   */
  static create({ eventBus, logger }) {
    const isTizen = typeof window !== 'undefined' && Boolean(window.tizen && window.tizen.application);
    if (isTizen) {
      logger.info('Tizen platform detected: initializing TizenNativeBridge');
      return new TizenNativeBridge({ logger });
    }
    logger.info('Non-Tizen environment detected: initializing BrowserMockBridge');
    return new BrowserMockBridge({ eventBus, logger });
  }
}
