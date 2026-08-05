# GuideForge

A desktop video editor for game guide creators. Pause on the timeline, drop
keyboards / text / arrows / images that annotate character and ability
rotations, then export an MP4.

Built for Wuthering Waves-style rotation guides, with a plugin path for other
games (Genshin, ZZZ, League, Valorant).

## Stack

| Layer | Tech | Folder |
|-------|------|--------|
| UI | React (Next.js static export) + Redux Toolkit + Tailwind | `frontend/` |
| Backend | Go (HTTP sidecar; later ffmpeg rendering) | `backend/` |
| Shell | Tauri v2 (Rust) | `src-tauri/` |
| Docs | Design docs from day one | `docs/` |

**Architecture:** a Tauri shell owns the native window and spawns a Go sidecar
over localhost HTTP. The React UI is a static SPA served by Tauri; all app
state lives in Redux. See `docs/Architecture.md`.

## Prerequisites

- Node.js 20+ (LTS)
- Go 1.22+
- Rust (stable, with MSVC toolchain — VS Build Tools 2022)
- FFmpeg (for M8 rendering)
- Git

## Quick start

```sh
npm install                 # root tooling + @tauri-apps/cli
npm run backend:build       # compile Go sidecar into src-tauri/binaries
npm run dev                 # launch the desktop app (Tauri)
```

Debug the UI alone in a browser (no Tauri window):

```sh
npm run backend:dev         # run the Go backend
npm run frontend:dev        # Next dev server on http://localhost:3000
open http://localhost:3000  # "Hello GuideForge" connects to the backend
```

Build installers: `npm run build`.

## Status

Milestone 1 (project foundation) is complete and verified end-to-end. See
`docs/Roadmap.md` for the full 10-milestone plan.

## Roadmap status

- ✅ **M1 Foundation** — desktop window, React + Redux + Go connected
- ⬜ M2 Layout → M3 Player → M4 Timeline → M5 Overlays → M6 Inspector
- ⬜ M7 Editing → M8 Rendering → M9 Project files → M10 Polish