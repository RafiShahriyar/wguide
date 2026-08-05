# Architecture

GuideForge is a desktop application built from three cooperating layers.

```
+------------------------------------------------------------+
| React (Next.js static export)   frontend/                  |
|  - UI in the webview, all client-side                       |
|  - Redux Toolkit owns all application state                 |
+------------------------------------------------------------+
                |  localhost HTTP (JSON)
                v
+------------------------------------------------------------+
| Go backend (sidecar)            backend/                   |
|  - HTTP server on 127.0.0.1:3939                            |
|  - M1: /health, /version                                    |
|  - later: ffprobe, timeline render, ffmpeg orchestration    |
+------------------------------------------------------------+
                |  spawned on startup, killed on exit
                v
+------------------------------------------------------------+
| Tauri shell (Rust)             src-tauri/                  |
|  - Owns the native window and process lifecycle             |
|  - Spawns the Go sidecar via tauri-plugin-shell             |
+------------------------------------------------------------+
```

## Why three layers

- **Tauri/Rust** — smallest possible native shell. WebView2 renders the UI,
  Rust manages the window and child processes. There is no Electron-sized
  runtime.
- **Go sidecar** — a separate native process for heavy work (video probing,
  frame extraction, ffmpeg rendering). If rendering crashes, the editor keeps
  running. Go is also fast to write and easy to read for a portfolio.
- **React/Redux** — the timeline is a state-heavy UI (positions, keys,
  selections, playback). Redux gives predictable, testable state with
  time-travel-style debugging.

## Communication

- Frontend -> backend: plain `fetch()` over `http://127.0.0.1:3939` with a
  short timeout and AbortController. No WebSocket yet; polling/request-response
  is enough for M1.
- Rust -> backend: process lifecycle only (spawn on setup, kill on exit). The
  sidecar also watches its own stdin; if the parent dies the pipe closes and the
  backend shuts itself down (no orphan processes).

## Layout

```
frontend/          Next.js app (static export -> out/)
  app/             routes, layout, providers
  components/      shared dumb UI
  features/        one folder per feature (slice + selectors + UI)
  store/           configureStore, RootState, AppDispatch
  hooks/           typed useAppDispatch / useAppSelector
  types/           shared TypeScript models
  utils/           pure helpers
backend/           Go module (module guideforge/backend)
  cmd/server/      entrypoint + graceful shutdown
  internal/api/    routes, handlers, CORS
src-tauri/         Rust shell
  src/lib.rs       builder, sidecar spawn/kill
  binaries/        compiled Go sidecar (gitignored)
docs/              design docs
assets/            source assets (app icon, etc.)
scripts/           build helper scripts
```

## Key decisions

- **Next.js static export** (`output: "export"`): a desktop app has no server,
  so the frontend is a static SPA exported to `out/` and served by Tauri.
  `next dev` is still used for fast browser iteration.
- **Fixed localhost port (3939)** for M1. Configurable via
  `GUIDEFORGE_BACKEND_PORT` if ever needed.
- **CORS is wide open (`*`)** for now; the backend binds to 127.0.0.1 only, so
  the exposure is local. Revisit before shipping.
