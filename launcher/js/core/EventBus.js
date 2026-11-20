/**
 * Minimal, synchronous Pub/Sub bus (Observer pattern).
 *
 * - Subscribers are isolated: one throwing handler never prevents delivery to
 *   the others, and never bubbles up to the publisher.
 * - `on()` returns an unsubscribe function so components can release
 *   listeners deterministically in `destroy()` (no leaks across overlays).
 * - `replay` topics remember their last payload, so late subscribers (e.g. a
 *   footer mounted after HA already connected) start with the current value.
 */
export class EventBus {
  /**
   * @param {{ logger: import('./Logger.js').Logger, replayTopics?: string[] }} deps
   */
  constructor({ logger, replayTopics = [] }) {
    this._logger = logger;
    /** @type {Map<string, Set<Function>>} */
    this._handlers = new Map();
    this._replayTopics = new Set(replayTopics);
    /** @type {Map<string, unknown>} */
    this._lastPayload = new Map();
  }

  /**
   * @param {string} topic
   * @param {(payload: any) => void} handler
   * @returns {() => void} unsubscribe
   */
  on(topic, handler) {
    if (!this._handlers.has(topic)) this._handlers.set(topic, new Set());
    this._handlers.get(topic).add(handler);

    if (this._lastPayload.has(topic)) {
      this._deliver(topic, handler, this._lastPayload.get(topic));
    }
    return () => this.off(topic, handler);
  }

  /**
   * @param {string} topic
   * @param {(payload: any) => void} handler
   */
  off(topic, handler) {
    const set = this._handlers.get(topic);
    if (set) set.delete(handler);
  }

  /**
   * @param {string} topic
   * @param {any} [payload]
   */
  emit(topic, payload) {
    if (this._replayTopics.has(topic)) this._lastPayload.set(topic, payload);
    const set = this._handlers.get(topic);
    if (!set || set.size === 0) return;
    // Snapshot so handlers may unsubscribe while being notified.
    Array.from(set).forEach((handler) => this._deliver(topic, handler, payload));
  }

  /** @private */
  _deliver(topic, handler, payload) {
    try {
      handler(payload);
    } catch (error) {
      this._logger.error(`Subscriber failed on "${topic}"`, error);
    }
  }
}
