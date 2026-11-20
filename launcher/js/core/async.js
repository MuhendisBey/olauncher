/**
 * Small promise utilities shared by adapters and services.
 */

export class TimeoutError extends Error {
  /** @param {string} operation @param {number} ms */
  constructor(operation, ms) {
    super(`${operation}: ${ms} ms içinde yanıt alınamadı`);
    this.name = 'TimeoutError';
  }
}

/**
 * Rejects if `promise` does not settle within `ms`. Tizen callbacks can stay
 * silent forever on some firmware paths; every platform call is wrapped.
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} operation
 * @returns {Promise<T>}
 */
export function withTimeout(promise, ms, operation) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(operation, ms)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); },
    );
  });
}

/**
 * Adapts a Tizen-style `(success, error)` callback API into a Promise.
 * Synchronous throws (e.g. missing privilege → SecurityError) also reject.
 * @template T
 * @param {(resolve: (v: T) => void, reject: (e: any) => void) => void} executor
 * @returns {Promise<T>}
 */
export function fromCallback(executor) {
  return new Promise((resolve, reject) => {
    try {
      executor(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

/** @param {number} ms */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
