/**
 * Loads JSON with XMLHttpRequest.
 *
 * Deliberately not `fetch`: inside a packaged .wgt the page runs from
 * `file://`, where Chromium rejects `fetch()` but Tizen's runtime still
 * serves local XHR (status 0 + body). Works identically over http in preview.
 */
export class XhrJsonTransport {
  /** @param {{ timeoutMs?: number }} [options] */
  constructor({ timeoutMs = 4000 } = {}) {
    this._timeoutMs = timeoutMs;
  }

  /**
   * @param {string} url
   * @returns {Promise<any>}
   */
  get(url) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.timeout = this._timeoutMs;
      xhr.overrideMimeType('application/json');
      xhr.onload = () => {
        const okStatus = xhr.status === 0 || (xhr.status >= 200 && xhr.status < 300);
        if (!okStatus || !xhr.responseText) {
          reject(new Error(`${url} okunamadı (HTTP ${xhr.status})`));
          return;
        }
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (error) {
          reject(new Error(`${url} geçerli JSON değil: ${error.message}`));
        }
      };
      xhr.onerror = () => reject(new Error(`${url} yüklenemedi`));
      xhr.ontimeout = () => reject(new Error(`${url} zaman aşımı`));
      xhr.send();
    });
  }
}
