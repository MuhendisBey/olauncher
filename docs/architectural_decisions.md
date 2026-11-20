# Architectural Decision Records (ADR)

## ADR-001: Independent Dual-Repo Public / Private Ops Separation
- **Context:** OLauncher contains general-purpose Tizen 6.5 launcher code alongside household secrets (Home Assistant long-lived token, local LAN IPs, family portrait, TV DUID/MAC baseline, raw disassembly dumps, and SDB command tools).
- **Decision:** Separate into two independent sibling Git repositories under a non-Git umbrella workspace: `olauncher/` (MIT public-ready app) and `samsungTVOlauncher-ops/` (Proprietary private ops using `SOPS + age` and `just`). Do not use Git submodules.
- **Consequences:** Clean open-source clone/build/test experience (`npm test`, `npm run hygiene`, `npm run package` pass without private files) while personal builds hydrate gitignored overrides via `just sync-local`.

## ADR-002: 1080p Logical CSS Stage with `fitStage()` Scaling
- **Context:** Tizen 6.5 Web Runtime renders a `1920x1080` logical CSS viewport on 4K (`3840x2160`) panels.
- **Decision:** Author all UI coordinates at `3840x2160` inside `#stage` and apply uniform `scale = min(innerWidth / 3840, innerHeight / 2160)` via an inline pre-paint script in `launcher/index.html`, locking scroll at `(0, 0)`.
- **Consequences:** Pixel-accurate layout across both 1080p Tizen TV WebViews and arbitrary desktop preview windows.

## ADR-003: Zero-Blur Prismatic Glassmorphism & Fixed 7-Card Rail
- **Context:** CSS `backdrop-filter: blur()` forces Mali-G52 GPU readbacks per frame, dropping framerate to 15–20 FPS. More than 7 cards overflow the `3840px` rail and shift the viewport.
- **Decision:** Emulate layered glass via translucent gradients, `::before` diagonal sheen, `::after` 2px top bevel, and `inset` shadows using GPU-composited `transform`/`scale`, capped strictly at `rail_limit = 7`.
- **Consequences:** Sustained 60 FPS navigation with zero horizontal viewport shift.

## ADR-004: Clean Window Focus Handoff & Deferred Surface Yield
- **Context:** Abrupt launcher termination or premature `currentApp.hide()` leaves orphaned Enlightenment focus (causing `cursormgr_module.so` 27–30s cursor center-warp in fullscreen browser video) or flashes the previously active app from the Z-stack during ~800ms app launches.
- **Decision:** Enable `multitasking.support="true"` and `homereturnsupport="true"`, execute `window.blur()` + `document.activeElement.blur()` and close the HA WebSocket before `tizen.application.launch()`, and suspend timers/UI only on natural `visibilitychange` (`document.hidden === true`). Never alter global `pointing_available` vconf keys.
- **Consequences:** 0ms instant resume on Home/Back, zero background Z-stack flashes, and zero phantom cursor warps without breaking browser pointer mode.

## ADR-005: HDR10+ 1024px Tile Damage Isolation & $N=1$ Focus Layering
- **Context:** Resuming from 10-bit HDR10+ playback to 8-bit SDR triggers Mali-G52 tile-boundary clipping artifacts at $X = 1024\text{px}$ inside centered modals.
- **Decision:** Isolate `.modal-dialog` with `contain: paint; isolation: isolate; transform: translate3d(0, 0, 0); backface-visibility: hidden;`, promote only `.is-focused` items to 3D hardware layers ($N=1$), and run a single micro-frame `_rehydrateGpuSurface()` flush on `_resumeActivity()`.
- **Consequences:** Eliminates modal split-button glitches after HDR playback without GPU VRAM layer explosion.
