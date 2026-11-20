# OLauncher — Software Architecture & Component Specifications

## 1. System Design Pattern

OLauncher follows a modular **Event-Driven Component Architecture** with zero runtime compilation or bundlers. Every component is an ES6 standard module loaded directly by the Chromium 85 engine.

```
                      +-------------------+
                      |   launcher/index  |
                      | (Inline Watchdog) |
                      +---------+---------+
                                |
                                v
                      +-------------------+
                      |    js/main.js     |
                      |  (Orchestrator)   |
                      +----+---------+----+
                           |         |
         +-----------------+         +-----------------+
         v                                             v
+-------------------+                         +-------------------+
|  NavigationManager|                         |  PlatformBridge   |
| (Spatial 2D Grid) |                         | (Tizen / Browser) |
+-------------------+                         +-------------------+
         |                                             |
         v                                             v
+-------------------+                         +-------------------+
|    UI Tree:       |                         |  Home Assistant   |
| - ClockHeader     |                         |  WebSocket Client |
| - TelemetryHeader |                         | (Climate/Weather) |
| - AppCardRail     |                         +-------------------+
| - AllAppsModal    |
| - RescueModal     |
| - FooterBar       |
+-------------------+
```

---

## 2. Core Subsystems

### 2.1. NavigationManager (`launcher/js/input/NavigationManager.js`)
* **Spatial 2D Navigation:** 
  * Main screen uses bounding-rect geometric distance vectors ($\Delta x, \Delta y$) with secondary-axis weighting ($2.5 \times$) to accurately track focus between the top header wrench button and the bottom app cards.
* **Modal 2D Grid Engine:**
  * When inside `AllAppsModal`, navigates a 4-column matrix:
    * `DOWN`: jumps $+4$ indexes to the exact card below, or jumps to the footer close button when on the bottom row.
    * `UP`: jumps $-4$ indexes to the exact card above.
    * `LEFT / RIGHT`: traverses horizontal neighbors.
* **Scroll Prevention:**
  * Uses `element.focus({ preventScroll: true })`.
  * `scrollIntoView()` is strictly constrained to active modal lists, completely eliminating viewport jitter or stage shifts.

### 2.2. Platform Bridge (`launcher/js/platform/`)
* **`ITizenBridge`**: Abstract contract for TV operations (`getInstalledApps`, `launchApp`, `getSources`, `isRealTv`).
* **`TizenNativeBridge`**: Communicates with `window.tizen.application` and `window.tizen.systeminfo` with defensive 8000ms timeouts (`withTimeout`).
* **`BrowserMockBridge`**: Implements mock state for rapid PC desktop browser testing.

### 2.3. Home Assistant WebSocket Client (`launcher/js/ha/HomeAssistantClient.js`)
* Connects directly via WebSocket (`ws://192.0.2.104:8123/api/websocket` — configurable in `config.json`).
* Authenticates using long-lived JWT token.
* Listens to state changes:
  * `climate.*` and `sensor.*` entities: extracts `attributes.current_temperature` or numeric `state`.
  * `weather.*` entities: extracts state and forecasts.
* Emits state events on the central `EventBus` (`Topics.HA_ENTITY_UPDATED`).

### 2.4. Specular Prismatic Glass Engine (`launcher/css/style.css`)
* Replaces dynamic blur with 4-layer GPU compositing:
  1. Yarı saydam füme/marka gradyanı (`background: linear-gradient(145deg, ...)`)
  2. 2px üst prizmatik pah yansıması (`.app-card::after`)
  3. 140° diyagonal fiziksel cam yüzey parlaması (`.app-card::before`)
  4. Çift katmanlı iç ışık (`box-shadow: inset 0 2px 2px rgba(255,255,255,0.55)`)
* Bütün animasyonlar sadece `transform: translate3d()` ve `scale()` kullanır; repaint tetiklemez, 60 FPS garantilidir.

---

### 2.5. App Launching & Compositor Focus Handoff Lifecycle (`TizenNativeBridge.js`)

When launching native Samsung apps (especially `org.tizen.browser`), Tizen's window manager (Enlightenment compositor) requires an explicit, clean focus handoff before OLauncher's runtime process is torn down by the OS (`multitasking.support="false"`).

#### The Focus Orphan & 30s Cursor Warp Hazard:
```
[ OLauncher Active ]
         │
         ├─── launchApp("org.tizen.browser") without blur
         │        │
         │        ▼ (OLauncher process terminated by Tizen OS)
         │    [ Enlightenment Compositor: "Invalid client in FocusIn event" ]
         │        │
         │        ▼ (Cursor enters sensitive "warp-ready" state: [r5, #0x74]=1)
         │    [ 30s HA remote-server poll / browser.elf 30s timerIdle Boost ]
         │        │
         │        ▼ (cursormgr_module.so 0x3424: e_input_device_pointer_warp)
         └──► Cursor forcefully warps to center (1920, 1080) during fullscreen video!
```

#### The Clean Handoff & Seamless Multitasking Architecture (v1.12.1+):
```
[ User Selects App (YouTube / Browser / Stremio / Xbox) ]
         │
         ├──► 1. main.js: _suspendActivity(true) -> synchronous overlay & toast purge
         │
         ├──► 2. TizenNativeBridge.js: window.blur() & document.activeElement.blur()
         │        └── Cleanly detaches DOM focus and notifies Enlightenment compositor
         │
         ├──► 3. HomeAssistantClient.js: _closeSocketSilently() + _logQueue purge
         │        └── Eliminates pending WebSocket packets that could wake remote-server
         │
         ├──► 4. window.tizen.application.launch(appId)
         │        └── Target app launches. OLauncher stays visible until target paints its window.
         │            NO premature hide() -> prevents revealing previously active background apps (e.g. YouTube).
         │
         ├──► 5. Target app covers screen -> triggers visibilitychange (document.hidden = true)
         │        └── OLauncher suspends timers/sockets and yields surface in background.
         │
         ├──► 6. Fullscreen video in browser hides cursor @ 5s and NEVER reappears!
         │
         └──► 7. User presses Home / Back:
                  OLauncher resumes INSTANTLY in 0ms (no "OLauncher yükleniyor" splash, no cold boot delay)!
```

* **Zero Side-Effects:** Unlike modifying global system vconf keys (`pointing_available`), this pure window blur handoff leaves the TV's mouse and virtual remote pointing pointer 100% operational in desktop browsing mode while permanently eliminating phantom cursor popups in media playback. Forensic analysis details are summarized in [`docs/disassembly/README.md`](./disassembly/README.md).

#### HDR10+ Display Mode Recovery & Dynamic Compositing Isolation (v1.12.3+):
When resuming from 10-bit HDR10+ playback, Mali-G52 GPU display pipe reconfigures back to 8-bit SDR. To prevent tile-boundary clipping ($X=1024\text{px}$) in modal dialogs without incurring layer-explosion bottlenecks:
1. **Dialog Paint Containment:** `.modal-dialog` is isolated with `contain: paint; isolation: isolate; transform: translate3d(0, 0, 0); backface-visibility: hidden;`.
2. **Dynamic Focus Layering ($N=1$):** Only actively focused elements (`.is-focused`) receive 3D hardware promotion (`translate3d(0, 0, 0)`). Unfocused items remain flat DOM, bounding GPU VRAM overhead to a single texture regardless of menu size.
3. **Compositor Rehydration:** `_resumeActivity()` issues a lightweight micro-frame layout flush (`_rehydrateGpuSurface()`) ensuring Mali tile swapchains are fully synchronized upon foreground wake.
