# IPC (Inter-Process Communication)

How the three layers talk today and how that will evolve.

## Today (Milestone 1)

**Frontend -> Go backend: localhost HTTP**

- Base URL: `http://127.0.0.1:3939`
- Overridable with env `GUIDEFORGE_BACKEND_PORT`
- JSON request/response, `fetch()` from the webview
- CORS: `Access-Control-Allow-Origin: *` (backend binds to 127.0.0.1 only)
- 3-second timeout via `AbortController` so a dead backend fails fast

Endpoints:

| Method | Path | Response |
|--------|------|----------|
| GET | `/health` | `{"status":"ok","app":"GuideForge Backend","version":"0.1.0"}` |
| GET | `/version` | `{"version":"0.1.0"}` |

**Rust -> Go backend: process lifecycle**

- `src-tauri` spawns the sidecar on startup via `tauri-plugin-shell`
  (`sidecar("guideforge-backend")`).
- The compiled Go binary lives at `src-tauri/binaries/guideforge-backend-<triple>.exe`
  (externalBin naming). Built by `scripts/build-backend.ps1`.
- On `RunEvent::Exit` Rust kills the child. As a second layer of safety the Go
  backend watches its stdin — when the parent dies the pipe closes and Go shuts
  itself down.
- Go logs are streamed to the Rust console via the sidecar's stdout.

## Later milestones

- **Probe** (M3): `POST /probe` returns duration/resolution/fps for an opened
  video.
- **Render** (M8): `POST /render` accepts a serialized project, streams progress.
- **Tauri commands**: Rust still does not need to know editor logic; keep the
  boundary HTTP so the app remains testable in a plain browser during dev.
