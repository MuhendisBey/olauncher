import http from 'http';
import crypto from 'crypto';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

/**
 * Encodes a UTF-8 text string into an unmasked server-to-client WebSocket frame.
 * @param {string} text
 * @returns {Buffer}
 */
function encodeFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;

  let header;
  if (length <= 125) {
    header = Buffer.from([0x81, length]);
  } else if (length <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}

/**
 * Starts a standalone zero-dependency Mock Home Assistant server on the specified port.
 * @param {number} port
 * @returns {http.Server}
 */
export function startMockHAServer(port = 8123) {
  let currentTemp = 22.4;

  const server = http.createServer((req, res) => {
    if (req.url === '/api/') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: 'API running.' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n` +
      '\r\n'
    );

    console.log('[Mock-HA] Client connected. Sending auth_required');
    socket.write(encodeFrame(JSON.stringify({ type: 'auth_required', ha_version: '2024.10.0' })));

    let subscribedStateChanged = false;
    let subscribedTriggerId = null;
    let subscribedTvAction = false;

    // Safely ignore transport reset errors on client close
    socket.on('error', (err) => {
      // Common disconnect error when browser tab is reloaded/closed
      if (err.code !== 'EPIPE' && err.code !== 'ECONNRESET') {
        console.warn('[Mock-HA] Socket error:', err.message);
      }
    });

    // Simulation timer to gently update temperature every 15s
    const tempInterval = setInterval(() => {
      if (socket.destroyed || !socket.writable) {
        clearInterval(tempInterval);
        return;
      }
      currentTemp = Number((22.0 + Math.random() * 0.8).toFixed(1));
      const sensorStateObj = {
        entity_id: 'sensor.living_room_temperature',
        state: String(currentTemp),
        attributes: { unit_of_measurement: '°C', friendly_name: 'Living Room Temperature' },
        last_updated: new Date().toISOString()
      };
      const climateStateObj = {
        entity_id: 'climate.living_room',
        state: 'heat',
        attributes: { current_temperature: currentTemp, temperature: 23.0, friendly_name: 'Living Room Thermostat' },
        last_updated: new Date().toISOString()
      };
      if (subscribedTriggerId !== null) {
        for (const [entId, stateObj] of [
          ['sensor.living_room_temperature', sensorStateObj],
          ['climate.living_room', climateStateObj]
        ]) {
          const triggerMsg = {
            id: subscribedTriggerId,
            type: 'event',
            event: {
              variables: {
                trigger: {
                  platform: 'state',
                  entity_id: entId,
                  to_state: stateObj
                }
              }
            }
          };
          try {
            socket.write(encodeFrame(JSON.stringify(triggerMsg)));
          } catch (_) {}
        }
      } else if (subscribedStateChanged) {
        for (const [entId, stateObj] of [
          ['sensor.living_room_temperature', sensorStateObj],
          ['climate.living_room', climateStateObj]
        ]) {
          const climateMsg = {
            type: 'event',
            event: {
              event_type: 'state_changed',
              data: {
                entity_id: entId,
                new_state: stateObj
              }
            }
          };
          try {
            socket.write(encodeFrame(JSON.stringify(climateMsg)));
          } catch (_) {}
        }
      }
    }, 15000);

    let buffer = Buffer.alloc(0);

    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);

      while (buffer.length >= 2) {
        const firstByte = buffer[0];
        const opcode = firstByte & 0x0f;
        const secondByte = buffer[1];
        const isMasked = Boolean(secondByte & 0x80);
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (buffer.length < 4) break;
          payloadLen = buffer.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (buffer.length < 10) break;
          payloadLen = Number(buffer.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = isMasked ? 4 : 0;
        if (buffer.length < offset + maskLen + payloadLen) break;

        let mask = null;
        if (isMasked) {
          mask = buffer.slice(offset, offset + 4);
          offset += 4;
        }

        const payload = buffer.slice(offset, offset + payloadLen);
        buffer = buffer.slice(offset + payloadLen);

        if (mask) {
          for (let i = 0; i < payload.length; i++) {
            payload[i] ^= mask[i % 4];
          }
        }

        // Handle Close Frame (Opcode 0x8)
        if (opcode === 0x8) {
          clearInterval(tempInterval);
          try {
            socket.write(Buffer.from([0x88, 0x00]));
            socket.end();
          } catch (_) {}
          break;
        }

        // Handle Ping Frame (Opcode 0x9)
        if (opcode === 0x9) {
          try {
            const pong = Buffer.concat([Buffer.from([0x8a, payload.length]), payload]);
            socket.write(pong);
          } catch (_) {}
          continue;
        }

        // Handle Pong Frame (Opcode 0xA)
        if (opcode === 0xa) {
          continue;
        }

        // Handle Text Frame (Opcode 0x1)
        if (opcode === 0x1) {
          const text = payload.toString('utf8');
          try {
            const msg = JSON.parse(text);
            handleMessage(msg);
          } catch (err) {
            console.error('[Mock-HA] Error parsing client frame:', err.message);
          }
        }
      }
    });

    socket.on('close', () => {
      clearInterval(tempInterval);
      console.log('[Mock-HA] Client disconnected');
    });

    function handleMessage(msg) {
      if (msg.type === 'auth') {
        console.log('[Mock-HA] Auth received. Authorizing client.');
        socket.write(encodeFrame(JSON.stringify({ type: 'auth_ok', ha_version: '2024.10.0' })));
        return;
      }

      if (msg.type === 'ping') {
        socket.write(encodeFrame(JSON.stringify({ id: msg.id, type: 'pong' })));
        return;
      }

      if (msg.type === 'get_states') {
        socket.write(encodeFrame(JSON.stringify({
          id: msg.id,
          type: 'result',
          success: true,
          result: [
            {
              entity_id: 'climate.living_room',
              state: 'heat',
              attributes: {
                current_temperature: currentTemp,
                temperature: 23.0,
                unit_of_measurement: '°C',
                friendly_name: 'Living Room Thermostat'
              },
              last_updated: new Date().toISOString()
            },
            {
              entity_id: 'sensor.living_room_temperature',
              state: String(currentTemp),
              attributes: { unit_of_measurement: '°C', friendly_name: 'Living Room Temperature' },
              last_updated: new Date().toISOString()
            },
            {
              entity_id: 'weather.home',
              state: 'partlycloudy',
              attributes: { temperature: currentTemp },
              last_updated: new Date().toISOString()
            }
          ]
        })));
        return;
      }

      if (msg.type === 'subscribe_trigger') {
        subscribedTriggerId = msg.id;
        socket.write(encodeFrame(JSON.stringify({
          id: msg.id,
          type: 'result',
          success: true,
          result: null
        })));
        return;
      }

      if (msg.type === 'subscribe_events') {
        if (msg.event_type === 'state_changed') subscribedStateChanged = true;
        if (msg.event_type === 'tizen_tv_action') subscribedTvAction = true;

        socket.write(encodeFrame(JSON.stringify({
          id: msg.id,
          type: 'result',
          success: true,
          result: null
        })));
        return;
      }
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[Mock-HA] Mock Home Assistant WebSocket server listening on ws://127.0.0.1:${port}/api/websocket`);
  });

  return server;
}

if (process.argv[1]?.endsWith('mock-ha-server.mjs')) {
  startMockHAServer(8123);
}
