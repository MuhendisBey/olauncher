import { Topics } from '../core/Topics.js';

/**
 * Direct zero-dependency Home Assistant WebSocket client.
 * Connects to ws://<HA_IP>:8123/api/websocket
 *
 * Implements:
 * - Auth handshake (auth_required -> auth -> auth_ok / auth_invalid)
 * - Initial state retrieval via get_states
 * - Server-side filtered entity subscription via subscribe_trigger (fallback: state_changed)
 * - Remote command listening via custom event ("tizen_tv_action")
 * - Full zero-socket teardown on pause() so zero TCP/IO wakeups occur in background
 * - Resilient exponential backoff auto-reconnect while in foreground
 */
export class HomeAssistantClient {
  /**
   * @param {{
   *   config: import('../config/defaultConfig.js').DEFAULT_CONFIG['homeAssistant'],
   *   eventBus: import('../core/EventBus.js').EventBus,
   *   logger: import('../core/Logger.js').Logger
   * }} deps
   */
  constructor({ config, eventBus, logger }) {
    this._config = config;
    this._bus = eventBus;
    this._logger = logger.child('HomeAssistant');

    this._ws = null;
    this._msgId = 1;
    /** @type {Map<number, { resolve: (res: any) => void, reject: (err: any) => void, timer: any }>} */
    this._pendingRequests = new Map();
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._pingTimer = null;
    this._isDestroyed = false;
    this._status = 'disabled';
    this._isPaused = false;
    this._logQueue = [];
    this._pendingSourceReport = null;
  }

  /**
   * Starts the client if enabled in config.
   */
  start() {
    if (!this._config?.enabled) {
      this._setStatus('disabled');
      this._logger.info('Home Assistant integration is disabled in config');
      return;
    }
    this._isDestroyed = false;
    this._isPaused = false;
    this._connect();
  }

  /**
   * Disconnects permanently and stops all timers.
   */
  destroy() {
    this._isDestroyed = true;
    this._isPaused = true;
    this._closeSocketSilently('Client destroyed');
  }

  /**
   * Synchronously tears down the WebSocket connection and all timers
   * so zero network frames, timers, or DOM updates can wake Chromium in background.
   */
  pause() {
    if (this._isPaused && !this._ws) return;
    this._isPaused = true;
    this._closeSocketSilently('Client paused');
    this._status = 'paused';
  }

  /**
   * Re-opens WebSocket connection cleanly when OLauncher returns to foreground.
   */
  resume() {
    if (this._isDestroyed) return;
    if (typeof document !== 'undefined' && document.hidden) return;

    this._isPaused = false;
    if (!this._config?.enabled) return;

    if (this._ws && this._ws.readyState === WebSocket.OPEN && this._status === 'connected') {
      this._startHeartbeat();
      this._fetchMonitoredStates().catch((err) => {
        this._logger.warn('Failed to refresh HA states on resume:', err);
      });
      return;
    }

    this._reconnectAttempts = 0;
    this._connect();
  }

  /** @private */
  _isInactive() {
    return this._isDestroyed || this._isPaused || (typeof document !== 'undefined' && document.hidden);
  }

  /** @private */
  _closeSocketSilently(reason) {
    this._clearTimers();
    this._rejectAllPending(new Error(reason || 'Connection closed'));
    this._logQueue = [];

    const ws = this._ws;
    this._ws = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close(1000, 'olauncher_suspend');
      } catch (_) {}
    }
  }

  /** @private */
  _setStatus(status) {
    if (this._status === status) return;
    this._status = status;
    if (this._isInactive()) return;
    this._logger.info(`Connection status: ${status}`);
    this._bus.emit(Topics.HA_CONNECTION_CHANGED, { status });
  }

  /** @private */
  _connect() {
    if (this._isInactive()) return;
    this._closeSocketSilently('Reconnecting');

    const { haUrl } = this._config;
    if (!haUrl) {
      this._setStatus('disabled');
      return;
    }

    this._setStatus(this._reconnectAttempts === 0 ? 'connecting' : 'reconnecting');
    this._logger.info(`Connecting to HA: ${haUrl} (attempt #${this._reconnectAttempts + 1})`);

    let ws;
    try {
      ws = new WebSocket(haUrl);
      this._ws = ws;
    } catch (err) {
      this._logger.error('WebSocket creation failed:', err);
      this._scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      if (this._ws !== ws || this._isInactive()) {
        this._closeSocketSilently('Inactive after open');
        return;
      }
      this._logger.debug('WebSocket transport open; waiting for auth_required');
    };

    ws.onmessage = (event) => {
      if (this._ws !== ws || this._isInactive()) return;
      this._onMessage(event.data);
    };

    ws.onerror = (err) => {
      if (this._ws !== ws || this._isInactive()) return;
      this._logger.warn('WebSocket error:', err?.message || 'unknown error');
    };

    ws.onclose = (event) => {
      if (this._ws !== ws) return;
      this._ws = null;
      this._rejectAllPending(new Error('Connection closed'));
      if (!this._isInactive() && this._status !== 'auth_failed') {
        this._logger.warn(`WebSocket closed (code: ${event.code}, reason: "${event.reason || ''}")`);
        this._scheduleReconnect();
      }
    };
  }

  /** @private */
  _onMessage(rawData) {
    if (this._isInactive()) return;

    let msg;
    try {
      msg = JSON.parse(rawData);
    } catch (_) {
      this._logger.error('Invalid JSON from HA:', rawData);
      return;
    }

    switch (msg.type) {
      case 'auth_required':
        this._handleAuthRequired();
        break;
      case 'auth_ok':
        this._handleAuthOk();
        break;
      case 'auth_invalid':
        this._handleAuthInvalid(msg.message);
        break;
      case 'result':
        this._handleResult(msg);
        break;
      case 'event':
        this._handleEvent(msg);
        break;
      case 'pong':
        this._logger.debug('Pong received');
        break;
      default:
        this._logger.debug('Unhandled message type:', msg.type);
    }
  }

  /** @private */
  _handleAuthRequired() {
    if (this._isInactive()) return;
    this._setStatus('authenticating');
    const token = this._config.accessToken;
    this._sendRaw({ type: 'auth', access_token: token });
  }

  /** @private */
  _handleAuthOk() {
    if (this._isInactive()) {
      this._closeSocketSilently('Inactive on auth_ok');
      return;
    }
    this._reconnectAttempts = 0;
    this._setStatus('connected');
    this._startHeartbeat();
    this._initSubscriptions();
    this._flushLogQueue();

    if (this._pendingSourceReport) {
      const pending = this._pendingSourceReport;
      this._pendingSourceReport = null;
      this.reportActiveSource(pending);
    }
  }

  /** @private */
  _handleAuthInvalid(reason) {
    this._logger.error('Home Assistant Auth FAILED:', reason);
    this._setStatus('auth_failed');
    this._closeSocketSilently('Auth invalid');
  }

  /** @private */
  async _initSubscriptions() {
    if (this._isInactive()) return;
    try {
      // 1. Fetch current states of monitored entities immediately
      await this._fetchMonitoredStates();
      if (this._isInactive()) return;

      // 2. Subscribe ONLY to monitored entities via server-side trigger (fallback: state_changed)
      const monitored = this._config.entities || {};
      const entityIds = Array.from(new Set(Object.values(monitored).filter(Boolean)));
      if (entityIds.length > 0) {
        try {
          await this.sendRequest({
            type: 'subscribe_trigger',
            trigger: {
              platform: 'state',
              entity_id: entityIds
            }
          });
        } catch (_) {
          if (!this._isInactive()) {
            await this._subscribeToEvents('state_changed');
          }
        }
      }

      if (this._isInactive()) return;

      // 3. Subscribe to custom remote TV actions from HA (while launcher is open)
      const eventName = this._config.remoteActionEvent || 'tizen_tv_action';
      await this._subscribeToEvents(eventName);

      this._logger.info('HA initial subscriptions active');
    } catch (err) {
      if (!this._isInactive()) {
        this._logger.warn('Error establishing HA subscriptions:', err);
      }
    }
  }

  /** @private */
  async _fetchMonitoredStates() {
    const states = await this.sendRequest({ type: 'get_states' });
    if (!Array.isArray(states) || this._isInactive()) return;

    const monitored = this._config.entities || {};
    const entityMap = new Map();
    states.forEach((s) => entityMap.set(s.entity_id, s));

    Object.entries(monitored).forEach(([role, entityId]) => {
      const stateObj = entityMap.get(entityId);
      if (stateObj) {
        this._notifyEntityUpdate(role, stateObj);
      }
    });
  }

  /** @private */
  _subscribeToEvents(eventType) {
    return this.sendRequest({
      type: 'subscribe_events',
      event_type: eventType
    });
  }

  /** @private */
  _handleResult(msg) {
    const pending = this._pendingRequests.get(msg.id);
    if (!pending) return;

    this._pendingRequests.delete(msg.id);
    clearTimeout(pending.timer);

    if (msg.success) {
      pending.resolve(msg.result);
    } else {
      pending.reject(new Error(msg.error?.message || 'HA request failed'));
    }
  }

  /** @private */
  _handleEvent(msg) {
    if (this._isInactive()) return;
    const ev = msg.event;
    if (!ev) return;

    // A) Server-side filtered subscribe_trigger payload
    const trigger = ev.variables?.trigger;
    if (trigger && trigger.to_state) {
      const entityId = trigger.entity_id || trigger.to_state.entity_id;
      const monitored = this._config.entities || {};
      for (const [role, registeredId] of Object.entries(monitored)) {
        if (registeredId === entityId) {
          this._notifyEntityUpdate(role, trigger.to_state);
          break;
        }
      }
      return;
    }

    const { event_type: eventType, data } = ev;

    // B) Fallback state_changed event
    if (eventType === 'state_changed' && data) {
      const { entity_id: entityId, new_state: newState } = data;
      if (!newState) return;

      const monitored = this._config.entities || {};
      for (const [role, registeredId] of Object.entries(monitored)) {
        if (registeredId === entityId) {
          this._notifyEntityUpdate(role, newState);
          break;
        }
      }
      return;
    }

    // C) Custom remote action event (e.g. tizen_tv_action)
    const remoteEvtName = this._config.remoteActionEvent || 'tizen_tv_action';
    if (eventType === remoteEvtName && data) {
      const { target, action } = data;
      const deviceId = this._config.deviceId;

      if (deviceId && target && target !== deviceId && target !== 'all') {
        this._logger.debug(`Ignored action intended for target ${target} (this TV is ${deviceId})`);
        return;
      }

      this._logger.info(`Received remote action: ${action}`);
      this._bus.emit(Topics.HA_REMOTE_ACTION, { action, payload: data });
    }
  }

  /** @private */
  _notifyEntityUpdate(role, stateObj) {
    if (this._isInactive()) return;
    this._logger.debug(`Entity update [${role}]: ${stateObj.state}`);
    this._bus.emit(Topics.HA_ENTITY_UPDATED, {
      role,
      entityId: stateObj.entity_id,
      state: stateObj.state,
      attributes: stateObj.attributes || {},
      lastUpdated: stateObj.last_updated
    });
  }

  /**
   * Sends a request message and returns a Promise with the result.
   * @param {object} payload
   * @returns {Promise<any>}
   */
  sendRequest(payload) {
    return new Promise((resolve, reject) => {
      if (this._isInactive() || !this._ws || this._ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const id = this._msgId++;
      const timer = setTimeout(() => {
        this._pendingRequests.delete(id);
        reject(new Error(`HA request id ${id} timed out`));
      }, this._config.requestTimeoutMs || 10000);

      this._pendingRequests.set(id, { resolve, reject, timer });
      this._sendRaw({ id, ...payload });
    });
  }

  /** @private */
  _sendRaw(obj) {
    if (!this._isInactive() && this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(obj));
    }
  }

  /**
   * Reports the currently active input source to Home Assistant.
   * Updates the configured input_select entity so HA and Apple Home reflect the active source.
   * @param {string} sourceName
   */
  reportActiveSource(sourceName) {
    if (!sourceName) return;
    const entityId = this._config?.sourceSelectEntity || 'input_select.living_room_tv_source';
    const payload = {
      type: 'call_service',
      domain: 'input_select',
      service: 'select_option',
      service_data: {
        entity_id: entityId,
        option: sourceName
      }
    };

    if (this._ws && this._ws.readyState === WebSocket.OPEN && this._status === 'connected') {
      try {
        this._sendRaw({ id: this._msgId++, ...payload });
        this._logger.info(`Reported active source to HA: "${sourceName}"`);
      } catch (err) {
        this._logger.warn(`Failed to report active source "${sourceName}":`, err);
      }
    } else {
      this._pendingSourceReport = sourceName;
    }
  }

  /**
   * Forwards an application log or diagnostic event to Home Assistant over WebSocket.
   * @param {string} level
   * @param {string} scope
   * @param {any} message
   */
  sendLog(level, scope, message) {
    if (this._isInactive()) return;
    if (scope && scope.toLowerCase().includes('homeassistant')) return;
    const text = typeof message === 'object' ? JSON.stringify(message) : String(message);
    const eventData = {
      level,
      scope,
      message: text,
      device_id: this._config.deviceId || 'living_room_tv',
      timestamp: new Date().toISOString()
    };

    if (this._ws && this._ws.readyState === WebSocket.OPEN && this._status === 'connected') {
      this._emitTvLog(eventData);
    } else {
      if (this._logQueue.length >= 40) this._logQueue.shift();
      this._logQueue.push(eventData);
    }
  }

  /** @private */
  _emitTvLog(eventData) {
    try {
      this._sendRaw({
        id: this._msgId++,
        type: 'fire_event',
        event_type: 'tizen_tv_log',
        event_data: eventData
      });
    } catch (_) {}
  }

  /** @private */
  _flushLogQueue() {
    while (this._logQueue.length > 0 && !this._isInactive()) {
      const item = this._logQueue.shift();
      this._emitTvLog(item);
    }
  }

  /** @private */
  _startHeartbeat() {
    clearInterval(this._pingTimer);
    if (this._isInactive()) return;
    const interval = this._config.heartbeatIntervalMs || 30000;
    this._pingTimer = setInterval(() => {
      if (this._isInactive()) {
        this._closeSocketSilently('Inactive during heartbeat');
        return;
      }
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        this._sendRaw({ id: this._msgId++, type: 'ping' });
      }
    }, interval);
  }

  /** @private */
  _scheduleReconnect() {
    this._clearTimers();
    if (this._isInactive()) return;

    const {
      initialDelayMs = 1000,
      maxDelayMs = 60000,
      multiplier = 2,
      jitterRatio = 0.25
    } = this._config.reconnect || {};

    let delay = Math.min(initialDelayMs * Math.pow(multiplier, this._reconnectAttempts), maxDelayMs);
    const jitter = delay * jitterRatio * (Math.random() * 2 - 1);
    delay = Math.max(500, Math.round(delay + jitter));

    this._reconnectAttempts++;
    this._logger.info(`Reconnecting in ${delay} ms...`);

    this._reconnectTimer = setTimeout(() => {
      this._reconnectTimer = null;
      if (!this._isInactive()) {
        this._connect();
      }
    }, delay);
  }

  /** @private */
  _rejectAllPending(error) {
    this._pendingRequests.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(error);
    });
    this._pendingRequests.clear();
  }

  /** @private */
  _clearTimers() {
    clearTimeout(this._reconnectTimer);
    clearInterval(this._pingTimer);
    this._reconnectTimer = null;
    this._pingTimer = null;
  }
}
