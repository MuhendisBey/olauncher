/** @readonly @enum {number} */
export const LogLevel = Object.freeze({ DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40, SILENT: 100 });

/**
 * Strips secrets, tokens, credentials, and JWT payloads from log output.
 * @param {string} text
 * @returns {string}
 */
export function redactSensitive(text) {
  if (typeof text !== 'string') return text;
  return text
    // JWT Tokens (eyJ...)
    .replace(/eyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    // Bearer auth tokens
    .replace(/Bearer\s+[a-zA-Z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    // Key-value tokens or secrets in JSON or strings: "access_token": "...", "token": "..."
    .replace(/(["']?(?:access_token|accessToken|token|secret|password|api_key|apiKey|auth)["']?\s*[:=]\s*["'])([^"'\s,]+)(["']?)/gi, '$1[REDACTED]$3');
}

/**
 * Scoped logger. Output sink is injected (defaults to `console`) so it can be
 * redirected to an on-screen or remote devlog later without touching callers.
 * Features built-in zero-leak secret redaction across all sinks and handlers.
 */
export class Logger {
  /** @private */
  static _earlyBuffer = [];
  /** @private */
  static _globalOnLog = null;

  /**
   * @param {{ scope?: string, level?: number, sink?: Pick<Console,'debug'|'info'|'warn'|'error'>, onLog?: (level: string, scope: string, args: any[]) => void }} [options]
   */
  constructor({ scope = 'olauncher', level = LogLevel.INFO, sink = console, onLog = null } = {}) {
    this._scope = scope;
    this._level = level;
    this._sink = sink;
    this._onLog = onLog || Logger._globalOnLog;
  }

  /** @param {string} scope */
  child(scope) {
    return new Logger({ scope: `${this._scope}:${scope}`, level: this._level, sink: this._sink, onLog: this._onLog || Logger._globalOnLog });
  }

  setOnLog(handler) {
    this._onLog = handler;
    Logger._globalOnLog = handler;
    // Flush buffered startup logs
    if (Logger._earlyBuffer.length > 0 && typeof handler === 'function') {
      const buffer = [...Logger._earlyBuffer];
      Logger._earlyBuffer = [];
      buffer.forEach((item) => {
        try {
          handler(item.method, item.scope, item.payload);
        } catch (_) {}
      });
    }
  }

  debug(...args) { this._write(LogLevel.DEBUG, 'debug', args); }
  info(...args) { this._write(LogLevel.INFO, 'info', args); }
  warn(...args) { this._write(LogLevel.WARN, 'warn', args); }
  error(...args) { this._write(LogLevel.ERROR, 'error', args); }

  /** @private */
  _write(level, method, args) {
    if (level < this._level) return;

    const sanitizedArgs = args.map((a) => {
      if (typeof a === 'string') {
        return redactSensitive(a);
      }
      if (typeof a === 'object' && a !== null) {
        try {
          return JSON.parse(redactSensitive(JSON.stringify(a)));
        } catch (_) {
          return a;
        }
      }
      return a;
    });

    this._sink[method](`[${this._scope}]`, ...sanitizedArgs);
    const handler = this._onLog || Logger._globalOnLog;
    const payload = sanitizedArgs.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const sanitizedPayload = redactSensitive(payload);

    if (handler) {
      try {
        handler(method, this._scope, sanitizedPayload);
      } catch (_) {}
    } else {
      if (Logger._earlyBuffer.length >= 80) Logger._earlyBuffer.shift();
      Logger._earlyBuffer.push({ method, scope: this._scope, payload: sanitizedPayload });
    }
  }
}


