# CLAUDE.md — GuideForge working context

> Purpose: transfer ALL working context about this project into a fresh Claude
> session: what the app is, the architecture, where we are, how we work
> together, and — most importantly — HOW I want you to teach me and respond.

## 1. What this project is

**GuideForge** — a desktop video editor for **game guide creators** (Wuthering
Waves / Genshin / ZZZ rotation guides). The user pauses the timeline on a game
recording, then places keyframes/overlays (keyboard inputs, text, arrows,
images) that annotate the character rotation. Later it exports an MP4 with the
overlays burned in.

- **I am a COMPLETE novice** at web development / React / TypeScript / Rust /
  Go / video tech. Assume zero background. Explain everything.
- This is a **learning project**: I want to understand every layer as we build
  it, not just get code.

## 2. Stack & architecture (three layers, one flow)

```
React UI (frontend/)  ──HTTP──►  Go backend (backend/)
     ▲                             │ spawned by
     └───────── Tauri shell (src-tauri/) ──► owns the window, keeps Go alive
```

- **Frontend**: Next.js static export (`output: "export"`) + React + **Redux
  Toolkit** (single store). Rendered in a webview. All app state lives in Redux.
- **Go backend**: a separate sidecar process on `http://127.0.0.1:3939`
  (overridable via `GUIDEFORGE_BACKEND_PORT`). Only `GET /health` + `GET /version`
  exist today. Does heavy/video work later.
- **Tauri (Rust)**: spawns/kills the sidecar via `tauri-plugin-shell`. Killed on
  app exit + a Go stdin-EOF watchdog. Compiled binary:
  `src-tauri/binaries/guideforge-backend-<triple>.exe`.
- M4/M5 note: the timeline is **frontend-only state math** — the sidecar is
  untouched by these milestones.

## 3. Repository layout

```
frontend/        Next.js app (app/, components/, features/, store/, hooks/, types/, utils/)
frontend/AGENTS.md  ← auto-generated/re-added by `next dev`; don't fight it
backend/         Go sidecar (cmd/server/, internal/api/)
src-tauri/       Rust/Tauri shell (src/, tauri.conf.json, binaries/ [gitignored], target/ [gitignored])
scripts/         build-backend.ps1, run-tauri.ps1 (resolve toolchains by absolute path)
docs/            design + learning docs (see §9)
assets/          icon source images
```

Feature folders live under `frontend/features/<feature>/` with
`<feature>Slice.ts`, `<feature>Selectors.ts`, `components/`, `hooks/`.

## 4. Commands (Windows, PowerShell 5.1)

```
npm run dev            # build Go sidecar + launch the Tauri window
npm run build          # full production: Go + Next static export + Rust release + MSI/NSIS
npm --prefix frontend run build   # fast TypeScript+export check (the usual verify step)
npm run frontend:dev   # Next dev server on http://localhost:3000
npm run backend:dev    # Go backend only
```

- Verify with `npm --prefix frontend run build` after each step (catches TS).
- Full gate: `npm run build` at the end of a milestone.
- NEVER assume a library is available; check first. We have react, react-dom,
  next, redux toolkit, react-redux, typescript, tailwindcss (zinc/emerald
  palette), tauri + tauri-plugin-shell, go stdlib, serde/tauri crates.
  **No test framework exists** — verification is typecheck + build + manual
  checklist + live backend curl.

## 5. Where we are (progress)

Milestones (see `docs/Roadmap.md`, table):
- ✅ M1 Foundation (Tauri + React + Redux + Go connected)
- ✅ M2 Layout System (menus, panels, dividers, status bar)
- ✅ M3 Video Player (open MP4, play/pause/seek, shortcuts)
- ✅ M4 Timeline Engine (playhead drag, anchored zoom, pan, adaptive ruler)
- ✅ **M4.5 Viewport limits** (interlude) — duration-aware zoom floor, pan
  clamped at both ends, Fit button. Found because a 22-min video could only
  show its first ~8 minutes.
- ✅ **M5 Overlay Engine** — all 6 steps done: 1) clip/track model
  2) lane blocks 3) preview overlay 4) add at playhead 5) properties editing
  6) verification. Ships the `keyboard` and `text` kinds only.
- 🔨 **M6 Property Inspector — NEXT.** A 6-step plan has been *presented* but
  the user has **not said "go"** yet. See §5b. Do not start coding until they
  approve it (and confirm the four open decisions).
- ⬜ M7 Timeline Editing, M8 Rendering (ffmpeg MP4), M9 Project Files
  (guideforge.project JSON), M10 Polish.

M5 deferred on purpose: mouse/arrow/image kinds; move/resize/snap and
multi-select (M7); per-overlay position/size (M6); persistence (M9) — clips
vanish on restart.

Git state:
- `main` = M1+M2. `dev` = M4+M4.5+M5 (squash-merged), pushed.
- `feature/m4-m5-timeline-overlays` holds the same work as one commit.
- Strategy: `main` stable, `dev` integration (squash-merge features),
  `feature/<milestone>` branches. Remote: github.com/RafiShahriyar/wguide.
- **Commit messages carry NO Claude co-author or "generated with" trailer** —
  the user asked for this explicitly.

## 5a. Verified state of the build (last checked at end of M5)

- `npm --prefix frontend run build` — clean.
- `npm run build` (full gate) — clean: Go + Next export + Rust **release**
  (~3m30s) + both bundles: `GuideForge_0.1.0_x64_en-US.msi` and
  `GuideForge_0.1.0_x64-setup.exe` under `src-tauri/target/release/bundle/`.
- Backend answers on 3939: `/health` → `{"status":"ok","app":"GuideForge
  Backend","version":"0.1.0"}`, `/version` → `{"version":"0.1.0"}`.
  ⚠️ That reply came from an **orphaned** backend left over from an earlier
  session, not a freshly launched one — see the `backend:dev` bug in §10.
- **The M5 manual checklist (10 items, `docs/Learning.md` → "Step 6") has NOT
  been run by the user yet.** Ask before assuming M5 behaviour is confirmed.
  Item 3 matters most: scrub to exactly `start + length` and check the overlay
  disappears — types and builds cannot catch a `<=` there.

## 5b. M6 plan — PROPOSED, awaiting the user's "go"

M6 = give each overlay its own geometry. Today every overlay stacks
bottom-centre at a fixed size. ("Duration" from the roadmap row already shipped
in M5 as the Length field.)

| # | Step | What lands |
|---|------|------------|
| 1 | Geometry in the model | `transform` on every clip: `x, y, scale, rotation, opacity` |
| 2 | Render the transform | preview honours it instead of stacking bottom-centre |
| 3 | Drag to position | grab an overlay on the video and move it |
| 4 | Inspector controls | sliders + number fields for all five, plus reset |
| 5 | Fade in / fade out | pure `clipOpacityAt(clip, time)` envelope |
| 6 | Guard rails + verification | clamps, full gate, checklist, docs |

Teaching angles agreed for each step: (1) *what units?* — the M4 "seconds not
pixels" question again; (2) CSS `transform` order, and font size derived from
the measured frame height rather than a fixed `text-sm`; (3) pixels→fractions,
the mirror of `xToTime`, reusing pointer capture; (4) extract a reusable field
component from `ClipInspector` (the "extract on second use" rule); (5)
interpolation from first principles, pure because M8 calls it per frame;
(6) also fixes the M5 leftover — `clip.start` is never clamped against the
video's length.

**Four open decisions** (recommendations given; user has not confirmed):

1. **Coordinates normalized 0–1** — `x: 0.5, y: 0.85` = "halfway across, 85%
   down". Resolution-independent, survives export at any size. Alternative
   (native-resolution pixels) breaks on a different export size.
2. **Scale relative to frame HEIGHT** — `scale: 1` = a sensible default size.
   Height, not width, so overlays don't shrink oddly on ultrawide footage.
3. **Anchor at the overlay's centre** — rotation around the centre feels
   natural; top-left anchoring swings a rotated overlay away from the cursor.
4. **Drag-on-video belongs in M6** — it is positioning, not timeline editing.
   Dragging clips *along the timeline* stays in M7.

**Explicitly NOT in M6:** keyframed animation (values changing over time — a
much bigger model change), the mouse/arrow/image kinds, timeline
drag/resize/snap (M7), persistence (M9).

## 6. HOW I WANT RESPONSES (read this carefully — it matters most)

1. **One step at a time.** We progress exactly one planned step per turn. I say
   "go" before you implement. Before a milestone you present a numbered
   step-by-step plan first (like the M3/M4/M5 plans).
2. **Teach before/with the code.** Do not just emit code. Explain:
   - What each new file does and why it exists
   - The data flow (who writes, who reads, via what)
   - New concepts from first principles
   - Pitfalls you hit
3. **Explain by worked example.** This is my favourite format (see the M3
   "worked example" in `docs/Learning.md`): trace a concrete user action
   click-by-click → which event fires → what the store now holds → what renders.
   Use analogies and concrete numbers. New learning material should follow that
   style.
4. **Append to `docs/Learning.md` after EVERY step.** Title like
   "### Step N — <name>", containing: files touched, new concepts, a worked
   example, pitfalls. Also keep the file map appendix current.
5. **Answer my conceptual questions patiently.** When I ask "what is X" or "how
   does Y work", give a clear first-principles explanation with a diagram or a
   tiny example — not a wall of jargon. Confirm I understand before moving on.
6. **Chat style:** warm, patient, plain English; concise summaries at the end of
   a step ("done, build passing, notes appended, next is X").
7. Keep code comments explanatory (teaching comments are welcome — this project
   prioritizes learning over brevity), but no placeholder/dead code.

## 7. Coding conventions we established

- Components ≤ ~300 lines; extract on the second use of any pattern.
- One Redux slice per responsibility, registered in `frontend/store/store.ts`.
- Strict TypeScript, **no `any`**. Feature folders per feature.
- UI text/data: never hardcode a repeated value — extract (e.g. `as const`
  data arrays, `STATUS_PRESENTATION`, `DEFAULT_PANEL_SIZES`).
- Reducers stay **pure**: side effects (revokeObjectURL, DOM work, .click())
  live in components/effects, never in reducers.
- `docs/ProjectFormat.md` rule: data stores **absolute time**, never pixels;
  zoom/pan/selection are UI state.
- Known TS pitfall: null-narrowing is lost inside closures — capture
  `const el = ref.current!` in effects.

Rules learned during M4/M5 — apply them, don't re-derive them:

- **A discriminated union's union must be at the TOP level.** `interface X {
  kind: K; props: A | B }` does NOT narrow — checking `kind` tells TypeScript
  nothing about `props`. Write `type X = XA | XB` with a literal `kind` on each.
  (M5 Step 3 had to rewrite `types.ts` for exactly this.)
- **Invariants live in the reducer, not the form.** `updateClip` clamps
  `start >= 0` and `duration >= MIN_CLIP_DURATION`, so M7's drag and M9's file
  loader get them free. A rule that must always hold belongs where the data
  changes.
- **Raw keystrokes are UI state; the parsed value is data.** Only where the two
  genuinely differ (the comma-separated Keys field → `string[]`). Its re-seed
  effect depends on `clip.id` ONLY — depending on the parsed value overwrites
  what the user is typing. `name`/`text` need no draft.
- **When a reducer needs a fact another slice owns, pass it in the payload.**
  Viewport actions carry `bounds: { duration, width }` because `duration` is in
  the player slice and `width` is measured from the DOM. Visible in the type
  signature, and the reducer stays pure.
- **Pass down only what the store cannot know.** `TimelineToolbar` takes one
  prop (`width`) and reads everything else from the store itself.
- **Repeating `stopPropagation` means the layout is wrong.** The toolbar moved
  outside the pointer-handling root instead of every button stopping
  propagation.
- **Culling is the norm:** `visibleTicks` and `isRectVisible` build DOM only for
  what is on screen, so cost scales with the panel, not the video.
- **Half-open intervals `[start, end)`** for anything time-ranged, so a clip
  ending at 2.0 and one starting at 2.0 never both match.
- Pure, React-free modules for anything M8's exporter must also compute:
  `timelineCoords.ts`, `activeClips.ts`, `newClip.ts`. The editor and the
  renderer must be able to run the same function and get the same answer.

## 8. Architecture patterns we rely on (keep them consistent)

- **Element is the source of truth.** The native `<video>` owns playback; Redux
  mirrors it: `loadedmetadata`→`setDuration`, `timeupdate`→`setTime`,
  `play`/`pause`→`setPlaying`. Store never drives playback.
- **Store→element command bridges** (VideoPlayer): `isPlaying` →
  `video.play()/pause()`; `seekRequest`+`seekTime` → `video.currentTime = t`.
  Keyboard shortcuts dispatch only Redux commands.
- **Single owner** for side effects (VideoPicker owns the file input; StatusBar
  owns the health-check dispatch).
- **Signals as counters** (`pickRequest`, `seekRequest`) so a menu/button can
  trigger a DOM action in another component via the store.
- **Viewport math is pure** (`features/timeline/timelineCoords.ts`):
  `timeToX`, `xToTime`, `tickStep`, `visibleTicks`. Zoom = px per second;
  anchored zoom keeps the second under the cursor pinned.
- Panels: layout slice stores `panels` sizes; `PanelDivider` (vertical +
  horizontal orientations) dispatches `resizePanel`; pointer capture + clamp.
- **The timeline slice holds two concerns on purpose**: the VIEWPORT (`zoom`,
  `viewportStart` — UI, never saved) and the DATA (`tracks`, `selectedClipId` —
  absolute seconds, saved in M9). Only `tracks` goes in the project file.
- **Clip position is always recomputed, never stored.** `clipRect(start,
  duration, viewportStart, zoom)` runs every render; no code "moves" a clip.
  Same for the playhead and the ruler — all three read the same two numbers,
  which is why they stay in lockstep through any zoom or pan for free.
- **Overlays anchor to the VIDEO box, not the panel.** `OverlayCanvas` measures
  the `<video>` element's own `offsetLeft/Top/Width/Height` with TWO
  ResizeObservers (the video resizes when metadata loads or the panel gets
  taller, but it *slides* when the panel width changes and its own size does
  not). Anchoring to the panel would float overlays over the letterbox bars and
  disagree with M8's export.

### Current M5 file map (`frontend/features/timeline/`)

```
types.ts             KeyboardClip | TextClip union, Track, ClipPatch, NewOverlayClip
timelineSlice.ts     viewport + clip data; setZoom/panBy/zoomAt/fitToWindow/
                     clampViewport + addClip/selectClip/updateClip/deleteClip
timelineSelectors.ts selectTimeline/Zoom/ViewportStart/Tracks/SelectedClipId,
                     selectSelectedClip (derived: id → the clip object)
timelineCoords.ts    PURE: timeToX, xToTime, tickStep, visibleTicks, clipRect,
                     isRectVisible, minZoomFor, maxViewportStart
activeClips.ts       PURE: isClipActive, activeClipsAt  (half-open interval)
newClip.ts           PURE: makeNewClip, DEFAULT_CLIP_DURATION, MIN_CLIP_DURATION
components/Timeline.tsx        ruler + lanes + playhead; scrub, wheel zoom/pan
components/TimelineToolbar.tsx + Keys / + Text / Fit  (outside the pointer root)
components/ClipBlock.tsx       one clip as a lane block; click selects
components/OverlayCanvas.tsx   live overlays drawn on the video preview
components/ClipInspector.tsx   the Properties form (rendered by PropertiesPanel)
```

## 9. Docs index (keep in sync)

- `docs/Roadmap.md` — milestone table + git/testing strategy.
- `docs/Architecture.md`, `docs/Redux.md` (slice map incl. timeline),
  `docs/IPC.md`, `docs/Renderer.md` (M8 pipeline), `docs/ProjectFormat.md`
  (guideforge.project JSON), `docs/Timeline.md` (design + M4 checklist).
- **`docs/Learning.md`** — the living mentor notes; append every step.

## 10. Windows/environment quirks

- PowerShell 5.1; use `;` and `if ($?)` for chaining (no `&&`).
- `scripts/build-backend.ps1` finds `go` and `rustc` by absolute path.
- **Orphaned backend issue** (known, fix deferred to M10): killing `npm run dev`
  can leave `guideforge.exe` + `guideforge-backend.exe` running and squatting
  port 3939. Diagnose: `Get-CimInstance Win32_Process -Filter "Name like
  'guideforge%'"`; clean: `Stop-Process -Id <pid> -Force`.
- Backend binary is named `guideforge-backend-<triple>.exe` (externalBin
  naming). Rust release builds are slow (first build ~several minutes).
- **`npm run backend:dev` is BROKEN** (found during the M5 verification pass):
  it runs `backend\bin\server.exe`, but `scripts/build-backend.ps1` emits
  `src-tauri/binaries/guideforge-backend-<triple>.exe`. The build half works;
  only the run path is stale. Fix the script in package.json, or run the built
  exe directly. `npm run dev` is unaffected — Tauri spawns the sidecar itself.
- Tauri build downloads WiX/NSIS on first bundle.

## 11. Reminders / known deferred items

- M10: Windows force-kill orphan watchdog; also pan-by-dragging the ruler,
  `Ctrl+0` for Fit (needs the measured width inside a hook), tooltips, undo/redo.
  (The zoom-fit *button* itself landed in M4.5.)
- M10: `currentTime` is mirrored from the `timeupdate` event, which fires only
  ~4×/s, so a preview overlay can appear/vanish up to ~250ms late **during
  playback**. Scrubbing is exact and the M8 export evaluates per frame, so this
  is cosmetic. Fix = a requestAnimationFrame mirror.
- Nothing clamps `clip.start` against the video's length — an overlay can be
  retimed past the end of the video. Harmless today; M6/M7 should fix it.
- `frontend/AGENTS.md` is auto-recreated by `next dev`; committing it is fine.
