/**
 * Anti-corruption layer between the user-facing `config.json` (snake_case,
 * Home Assistant style: `ha_url`, `access_token`, …) and the internal
 * camelCase model. Pure functions — no I/O — so they are trivially testable.
 */

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** @param {string} key */
const toCamel = (key) => key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

/**
 * Recursively converts object keys from snake_case to camelCase.
 * @param {unknown} value
 * @returns {unknown}
 */
export function camelizeKeys(value) {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (!isPlainObject(value)) return value;
  const out = {};
  Object.keys(value).forEach((key) => {
    out[toCamel(key)] = camelizeKeys(value[key]);
  });
  return out;
}

/**
 * Deep merge where objects merge and arrays/scalars from `override` replace.
 * @param {object} base
 * @param {object} override
 */
export function deepMerge(base, override) {
  if (!isPlainObject(override)) return base;
  const out = { ...base };
  Object.keys(override).forEach((key) => {
    const next = override[key];
    if (next === undefined) return;
    out[key] = isPlainObject(base[key]) && isPlainObject(next) ? deepMerge(base[key], next) : next;
  });
  return out;
}

/** @template T @param {T} obj @returns {Readonly<T>} */
export function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    Object.keys(obj).forEach((k) => deepFreeze(obj[k]));
  }
  return obj;
}

const WS_URL = /^wss?:\/\/[^\s/]+(:\d+)?\/api\/websocket\/?$/i;
const SUBSCRIPTION_MODES = ['trigger', 'events'];
const AFTER_SWITCH = ['viewer', 'switch'];

/**
 * Validates semantic rules. Never throws: problems are reported and the
 * affected feature is degraded (e.g. HA disabled) so the launcher still boots.
 * @param {any} config camelCase, already merged with defaults
 * @returns {{ config: any, warnings: string[] }}
 */
export function validateConfig(config) {
  const warnings = [];
  let ha = config.homeAssistant;

  if (ha.enabled) {
    if (ha.haUrl && typeof ha.haUrl === 'string') {
      // Normalize accidental duplicate slashes in path (e.g. :8123//api -> :8123/api)
      ha = { ...ha, haUrl: ha.haUrl.replace(/(wss?:\/\/[^/]+)\/+/i, '$1/') };
    }
    if (!WS_URL.test(ha.haUrl || '')) {
      warnings.push(`home_assistant.ha_url geçersiz ("${ha.haUrl}"). Beklenen: ws://<IP>:8123/api/websocket`);
    }
    if (!ha.accessToken || typeof ha.accessToken !== 'string') {
      warnings.push('home_assistant.access_token boş.');
    }
    if (warnings.length) ha = { ...ha, enabled: false };
  }
  if (SUBSCRIPTION_MODES.indexOf(ha.subscriptionMode) < 0) {
    warnings.push(`home_assistant.subscription_mode "${ha.subscriptionMode}" bilinmiyor; "trigger" kullanılıyor.`);
    ha = { ...ha, subscriptionMode: 'trigger' };
  }

  const inputs = (Array.isArray(config.inputs) ? config.inputs : []).filter((input) => {
    const ok = input && input.id && input.label && input.sourceType && Number(input.sourceNumber) > 0;
    if (!ok) warnings.push(`inputs: eksik alanlı giriş atlandı (${JSON.stringify(input)})`);
    return ok;
  }).map((input) => ({
    ...input,
    sourceNumber: Number(input.sourceNumber),
    afterSwitch: AFTER_SWITCH.indexOf(input.afterSwitch) >= 0 ? input.afterSwitch : 'viewer',
  }));

  const smartHubAppIds = (config.system.smartHubAppIds || []).filter(Boolean);
  if (!smartHubAppIds.length) warnings.push('system.smart_hub_app_ids boş; varsayılanlar kullanılacak.');

  return {
    config: { ...config, homeAssistant: ha, inputs },
    warnings,
  };
}
