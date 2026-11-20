/**
 * Pub/Sub topic names. Every cross-module message goes through one of these
 * constants so that publishers and subscribers never share magic strings.
 * @readonly
 * @enum {string}
 */
export const Topics = Object.freeze({
  CLOCK_TICK: 'clock:tick',

  HA_CONNECTION_CHANGED: 'ha:connection-changed',
  HA_ENTITY_UPDATED: 'ha:entity-updated',
  HA_REMOTE_ACTION: 'ha:remote-action',

  APPS_UPDATED: 'apps:updated',

  APP_VISIBILITY_CHANGED: 'app:visibility-changed',

  TOAST: 'ui:toast',
  OVERLAY_OPEN: 'ui:overlay-open',
  OVERLAY_CLOSE: 'ui:overlay-close',
  MEDIA_PLAY_PAUSE: 'media:play-pause'
});
