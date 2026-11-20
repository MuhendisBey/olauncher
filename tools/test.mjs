import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

console.log('\n========================================');
console.log('🧪 OLauncher Automated Test & Integrity Suite');
console.log('========================================\n');

// 1. Config Validation
console.log('[1/7] Testing launcher/config.example.json (and optional config.json) integrity...');
try {
  const exampleConfigPath = path.join(rootDir, 'launcher', 'config.example.json');
  assert(fs.existsSync(exampleConfigPath), 'launcher/config.example.json exists');
  const exampleConfig = JSON.parse(fs.readFileSync(exampleConfigPath, 'utf8'));

  assert(exampleConfig.apps && Array.isArray(exampleConfig.apps.pinned), 'config.example.json apps.pinned is an array');
  assert(exampleConfig.apps.pinned.length > 0, 'config.example.json apps.pinned contains entries');
  assert(
    exampleConfig.apps.browser && exampleConfig.apps.browser.app_id === 'org.tizen.browser',
    'Browser app is configured (org.tizen.browser)'
  );
  assert(exampleConfig.apps.pinned.some(a => a.id.toLowerCase().includes('stremio')), 'Stremio is pinned');
  assert(exampleConfig.apps.pinned.some(a => a.id.includes('Spotify')), 'Spotify is pinned');
  assert(exampleConfig.apps.rail_limit === 7, 'rail_limit is strictly 7 (Fixed 7-card stage rule)');
  assert(exampleConfig.home_assistant && exampleConfig.home_assistant.ha_url, 'Home Assistant URL is defined');

  const exampleWallpaperPath = path.join(rootDir, 'launcher', exampleConfig.display.wallpaper);
  assert(fs.existsSync(exampleWallpaperPath), `Example wallpaper asset exists: ${exampleConfig.display.wallpaper}`);

  const localConfigPath = path.join(rootDir, 'launcher', 'config.json');
  if (fs.existsSync(localConfigPath)) {
    const localConfig = JSON.parse(fs.readFileSync(localConfigPath, 'utf8'));
    assert(localConfig && typeof localConfig === 'object', 'Optional local launcher/config.json is valid JSON');
    const localWallpaperPath = path.join(rootDir, 'launcher', localConfig.display.wallpaper);
    assert(fs.existsSync(localWallpaperPath), `Local wallpaper asset exists: ${localConfig.display.wallpaper}`);
  }
} catch (err) {
  assert(false, `config validation error: ${err.message}`);
}

// 2. Tizen Manifest Validation
console.log('\n[2/7] Testing launcher/config.xml manifest...');
try {
  const xmlPath = path.join(rootDir, 'launcher', 'config.xml');
  assert(fs.existsSync(xmlPath), 'launcher/config.xml exists');
  const xml = fs.readFileSync(xmlPath, 'utf8');

  assert(xml.includes('id="OLauncher1.OLauncher"'), 'Manifest has application ID "OLauncher1.OLauncher"');
  assert(xml.includes('package="OLauncher1"'), 'Manifest has package ID "OLauncher1"');
  assert(xml.includes('http://tizen.org/privilege/application.launch'), 'Has application.launch privilege');
  assert(xml.includes('http://tizen.org/privilege/application.info'), 'Has application.info privilege');
  assert(xml.includes('http://tizen.org/privilege/tv.window'), 'Has tv.window privilege');
  assert(xml.includes('http://tizen.org/privilege/internet'), 'Has internet privilege');
  assert(!xml.includes('http://tizen.org/privilege/tv.audio'), 'Does NOT declare unused tv.audio privilege');
  assert(!xml.includes('http://tizen.org/privilege/tv.inputdevice'), 'Does NOT declare unused tv.inputdevice privilege');

  assert(xml.includes('pointing-device-support="disable"'), 'Has pointing-device-support="disable" setting');
  assert(xml.includes('background-support="disable"'), 'Has background-support="disable" setting');
  assert(
    xml.includes('key="http://samsung.com/tv/metadata/multitasking.support" value="true"'),
    'Enables background resident multitasking for instant resume (multitasking.support="true")'
  );
  assert(
    xml.includes('key="http://samsung.com/tv/metadata/homereturnsupport" value="true"'),
    'Enables homereturnsupport metadata for instant return'
  );
  assert(!xml.includes('prelaunch.support'), 'Does NOT keep background prelaunch process resident');

  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert(xml.includes(`version="${pkg.version}"`), `config.xml version matches package.json (${pkg.version})`);
  const versionJs = fs.readFileSync(path.join(rootDir, 'launcher', 'js', 'core', 'Version.js'), 'utf8');
  assert(versionJs.includes(`'${pkg.version}'`), `launcher/js/core/Version.js matches package.json (${pkg.version})`);

  // CSS TV Pointer and Cursor Rule Check
  const cssPath = path.join(rootDir, 'launcher', 'css', 'style.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert(!css.includes('cursor: pointer'), 'CSS does NOT contain desktop cursor: pointer');
  assert(css.includes('cursor: none !important'), 'CSS enforces global cursor: none !important');
} catch (err) {
  assert(false, `config.xml read error: ${err.message}`);
}

// 3. JavaScript Syntax Verification (node --check)
console.log('\n[3/7] Testing JS syntax across launcher/js/ tree...');
function checkJsFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkJsFiles(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      const relPath = path.relative(rootDir, fullPath);
      try {
        execSync(`node --check "${fullPath}"`);
        assert(true, `Syntax OK: ${relPath}`);
      } catch (err) {
        assert(false, `Syntax error in ${relPath}: ${err.message}`);
      }
    }
  }
}
checkJsFiles(path.join(rootDir, 'launcher', 'js'));

// 4. Zero-Interference Lifecycle & Browser Cursor Guard Tests
console.log('\n[4/7] Testing Zero-Footprint TV Lifecycle & WebSocket teardown...');
try {
  const bridgeSrc = fs.readFileSync(path.join(rootDir, 'launcher', 'js', 'platform', 'TizenNativeBridge.js'), 'utf8');
  assert(!bridgeSrc.includes('tvwindow.show'), 'TizenNativeBridge never binds AVOC MAIN plane via tvwindow.show');
  assert(bridgeSrc.includes('hideCurrentApp'), 'TizenNativeBridge implements hideCurrentApp for graceful surface yield');
  assert(!bridgeSrc.includes('tvinputdevice'), 'TizenNativeBridge never grabs hardware keys via tvinputdevice');

  const navSrc = fs.readFileSync(path.join(rootDir, 'launcher', 'js', 'input', 'NavigationManager.js'), 'utf8');
  assert(!navSrc.includes('element.focus'), 'NavigationManager uses pure CSS .is-focused without native Ewk_View element.focus()');
  assert(!navSrc.includes('scrollIntoView'), 'NavigationManager uses synchronous scroll math without smooth-scroll timers');

  // Behavioral unit test for HomeAssistantClient zero-socket pause/resume
  const { Logger } = await import('../launcher/js/core/Logger.js');
  const { EventBus } = await import('../launcher/js/core/EventBus.js');
  const { Topics } = await import('../launcher/js/core/Topics.js');
  const { HomeAssistantClient } = await import('../launcher/js/ha/HomeAssistantClient.js');

  const createdSockets = [];
  class FakeWebSocket {
    constructor(url) {
      this.url = url;
      this.readyState = FakeWebSocket.OPEN;
      this.closed = false;
      this.sent = [];
      this.onopen = null;
      this.onmessage = null;
      this.onerror = null;
      this.onclose = null;
      createdSockets.push(this);
    }
    send(data) {
      this.sent.push(JSON.parse(data));
    }
    close() {
      this.closed = true;
      this.readyState = FakeWebSocket.CLOSED;
      if (this.onclose) {
        this.onclose({ code: 1000, reason: 'closed' });
      }
    }
  }
  FakeWebSocket.OPEN = 1;
  FakeWebSocket.CLOSED = 3;
  globalThis.WebSocket = FakeWebSocket;

  const silentLogger = new Logger({
    scope: 'test',
    sink: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
  });
  const bus = new EventBus({ logger: silentLogger });
  let statusEventsWhilePaused = 0;

  const ha = new HomeAssistantClient({
    config: {
      enabled: true,
      haUrl: 'ws://127.0.0.1:8123/api/websocket',
      accessToken: 'test_token_redacted',
      entities: { temperature: 'climate.salon' },
      heartbeatIntervalMs: 30000
    },
    eventBus: bus,
    logger: silentLogger
  });

  ha.start();
  assert(createdSockets.length === 1, 'HomeAssistantClient opens WebSocket on foreground start()');
  const ws1 = createdSockets[0];
  ws1.onmessage({ data: JSON.stringify({ type: 'auth_required' }) });
  ws1.onmessage({ data: JSON.stringify({ type: 'auth_ok' }) });
  assert(ha._pingTimer !== null, 'Heartbeat timer active while foreground');

  ha.reportActiveSource('YouTube');
  const lastSent = ws1.sent[ws1.sent.length - 1];
  assert(
    lastSent &&
      lastSent.type === 'call_service' &&
      lastSent.domain === 'input_select' &&
      lastSent.service === 'select_option' &&
      lastSent.service_data?.option === 'YouTube' &&
      lastSent.service_data?.entity_id === 'input_select.living_room_tv_source',
    'reportActiveSource() sends valid input_select.select_option frame'
  );

  bus.on(Topics.HA_CONNECTION_CHANGED, () => {
    if (ha._isPaused) statusEventsWhilePaused++;
  });

  // Pause (simulating launching org.tizen.browser)
  ha.pause();
  assert(ws1.closed === true, 'ha.pause() synchronously closes the underlying TCP WebSocket');
  assert(ha._ws === null, 'ha.pause() clears internal _ws reference');
  assert(ha._pingTimer === null, 'ha.pause() clears heartbeat interval timer');
  assert(ha._reconnectTimer === null, 'ha.pause() does NOT schedule background reconnect timer');
  assert(statusEventsWhilePaused === 0, 'ha.pause() causes ZERO background DOM status mutations');

  // Resume (simulating returning to OLauncher)
  ha.resume();
  assert(createdSockets.length === 2, 'ha.resume() cleanly opens a fresh WebSocket when returning to foreground');
  ha.destroy();
  delete globalThis.WebSocket;
} catch (err) {
  assert(false, `Lifecycle unit test failed: ${err.message}`);
}

// 5. Native Rescue & Safety Guard Validation
console.log('\n[5/7] Testing native C++ rescue and safety guards...');
try {
  const nativeCtlPath = path.join(rootDir, 'native', 'tools', 'olauncher_native_ctl.cpp');
  const rescueMainPath = path.join(rootDir, 'native', 'rescue_app', 'src', 'rescue_main.cpp');
  const sdbSetupPath = path.join(rootDir, 'native', 'scripts', 'sdb-setup.sh');

  assert(fs.existsSync(nativeCtlPath), 'native/tools/olauncher_native_ctl.cpp exists');
  assert(fs.existsSync(rescueMainPath), 'native/rescue_app/src/rescue_main.cpp exists');
  assert(fs.existsSync(sdbSetupPath), 'native/scripts/sdb-setup.sh exists');

  const nativeCtlSrc = fs.readFileSync(nativeCtlPath, 'utf8');
  const rescueMainSrc = fs.readFileSync(rescueMainPath, 'utf8');

  assert(nativeCtlSrc.includes('sizeof(void*) != 4'), 'Native controller enforces 32-bit ARM guard');
  assert(nativeCtlSrc.includes('uid != 901'), 'Native controller enforces SDK UID 901 guard');
  assert(nativeCtlSrc.includes('com.samsung.tv.csfs'), 'Native controller supports Smart Hub restore target');
  assert(rescueMainSrc.includes('com.samsung.tv.csfs'), 'Rescue headless app restores com.samsung.tv.csfs');
} catch (err) {
  assert(false, `Native safety guard validation error: ${err.message}`);
}

// 6. Python Helper Tool Validation
console.log('\n[6/7] Testing Python Home Assistant helper tools...');
try {
  for (const relPy of ['deploy_ha_scripts.py', 'ha_remote_ctl.py']) {
    const pyPath = path.join(rootDir, 'tools', relPy);
    assert(fs.existsSync(pyPath), `tools/${relPy} exists`);
    execSync(`python3 -m py_compile "${pyPath}"`);
    assert(true, `Python syntax check passed for ${relPy}`);
  }
} catch (err) {
  assert(false, `Python tool check failed: ${err.message}`);
}

// 7. Sensitive Data Redaction Validation (Zero-Leak Rule)
console.log('\n[7/7] Testing sensitive data redaction & zero-leak logger rule...');
try {
  const { redactSensitive, Logger } = await import('../launcher/js/core/Logger.js');

  const jwtTag = 'ey' + 'J';
  const sampleJwt = `${jwtTag}fakeHeaderSeg123.${jwtTag}fakePayloadSeg456.fakeSig789`;
  const sampleBearer = 'Bearer opaque_bearer_secret_xyz123';
  const sampleJson = '{"access_token": "secret_abc123", "password": "supersecretpassword"}';

  const redactedJwt = redactSensitive(sampleJwt);
  assert(!redactedJwt.includes('fakePayloadSeg456'), 'JWT payload is redacted');
  assert(redactedJwt.includes('[REDACTED_JWT]'), 'JWT replaced with [REDACTED_JWT]');

  const redactedBearer = redactSensitive(sampleBearer);
  assert(!redactedBearer.includes('opaque_bearer_secret_xyz123'), 'Bearer token payload is redacted');
  assert(redactedBearer.includes('Bearer [REDACTED]'), 'Bearer replaced with Bearer [REDACTED]');

  const redactedJson = redactSensitive(sampleJson);
  assert(!redactedJson.includes('secret_abc123'), 'access_token value is redacted');
  assert(!redactedJson.includes('supersecretpassword'), 'password value is redacted');

  let intercepted = '';
  const logger = new Logger({
    scope: 'test',
    sink: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} },
    onLog: (level, scope, msg) => { intercepted = msg; }
  });
  logger.info('User authenticated with token:', sampleJwt);
  assert(!intercepted.includes('fakeSig789'), 'Logger output never leaks JWT token to onLog sink');
  assert(intercepted.includes('[REDACTED_JWT]'), 'Logger output contains [REDACTED_JWT]');
} catch (err) {
  assert(false, `Redaction test error: ${err.message}`);
}

console.log('\n----------------------------------------');
console.log(`Results: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
console.log('----------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('🎉 All integrity and architectural tests PASSED!\n');
}
