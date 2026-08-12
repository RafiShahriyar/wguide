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
.claude/         launch.json — dev-server config for the preview/browser tooling
```

⚠️ On the current machine the project sits at
`Downloads/wguide-main/wguide-main/` — a **nested** folder, because it started as
a GitHub "Download ZIP" rather than a clone. It was turned back into a real repo
in place (`git init`, remote added, `git reset --hard origin/main`) after checking
the tree was byte-identical to `58748e5`, so nothing was lost. The outer
`wguide-main/` is not part of the repo. Work from the inner directory.

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
- Full gate: `npm run build` at the end of a milestone — **blocked on the current
  machine, see §10.** M6 was developed entirely through `npm run frontend:dev` in
  a browser at `localhost:3000`, which needs neither Rust nor the Go sidecar. The
  frontend has **no Tauri dependency at all** (no `@tauri-apps/api` in
  `frontend/package.json`, zero Tauri calls in the source), and the video is
  loaded through an ordinary `<input type="file">` + `URL.createObjectURL`, so
  everything up to M8 can be built this way.
- Only the frontend install is needed for that: `npm install --prefix frontend`.
  The root `npm install` exists to fetch the Tauri CLI.
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
- ✅ **M6 Property Inspector** — all 6 steps done: 1) `transform` on every clip
  2) renderer honours it 3) drag on the video 4) five slider+number rows + Reset
  5) fade in/out envelope 6) guard rails. **Frontend-verified only**: the full
  `npm run build` gate could not run on this machine (see §10) and the 16-item
  checklist in `docs/Learning.md` → "Step 6" has **NOT been run**. Do not record
  M6 as green until both are done.
- 🔨 **M7 Timeline Editing — NEXT.** No plan presented yet; present a numbered
  step plan and wait for "go".
- ⬜ M8 Rendering (ffmpeg MP4), M9 Project Files (guideforge.project JSON),
  M10 Polish.

M5 deferred on purpose: mouse/arrow/image kinds; move/resize/snap and
multi-select (M7); per-overlay position/size (M6); persistence (M9) — clips
vanish on restart.

Git state:
- `main` = M1→M5. `dev` was merged into `main` via PR #4 (commit `fe0cae1`), so
  main is current through M5. M6 currently exists only as uncommitted
  working-tree changes on top of it.
- `feature/m4-m5-timeline-overlays` holds the same work as one commit.
- Strategy: `main` stable, `dev` integration (squash-merge features),
  `feature/<milestone>` branches. Remote: github.com/RafiShahriyar/wguide.
- **Commit messages carry NO Claude co-author or "generated with" trailer** —
  the user asked for this explicitly.

## 5a. Verified state of the build

**Current machine (M6 was built here):**

- `npm --prefix frontend run build` — clean after every M6 step. This is the only
  automated gate available here.
- `npm run build` (full gate) — **cannot run at all**; see the nested-PowerShell
  block in §10. Not a code problem.
- Go sidecar never launched here (nothing answers on 3939), so the StatusBar shows
  the backend offline and the browser console logs
  `GET 127.0.0.1:3939/health` refusals. **That is the expected shape of
  frontend-only development — not a bug to chase.**

**Previous machine (end of M5, for reference):** the full `npm run build` gate was
clean there — Go + Next export + Rust release (~3m30s) + both
`GuideForge_0.1.0_x64_en-US.msi` and `GuideForge_0.1.0_x64-setup.exe` under
`src-tauri/target/release/bundle/`. Backend answered on 3939. ⚠️ That reply came
from an **orphaned** backend, not a freshly launched one — see §10.

**Two manual checklists are outstanding. Ask before assuming either milestone's
behaviour is confirmed:**

- **M5, 10 items** — `docs/Learning.md` → "Step 6 — M5 verification pass". Item 3
  matters most: scrub to exactly `start + length` and check the overlay
  disappears. Types and builds cannot catch a `<=` there.
- **M6, 16 items** — `docs/Learning.md` → "The M6 manual checklist". The five that
  nothing automated can see: #5 drag past the left edge, #10 press Reset *twice*
  (the frozen-constant trap), #12 fade ramps rather than pops, #14 shrink Length
  below the fade, #15 Start beyond the end of the video.

### How to verify on this machine

Because `npm run dev` is blocked, M6 was verified three ways, and the same three
work for M7:

1. `npm --prefix frontend run build` after every step — TypeScript + static export.
2. **The in-app browser against `npm run frontend:dev`.** `.claude/launch.json`
   defines a `frontend` server on port 3000 for the preview tooling; if port 3000
   is already busy that is usually the user's own `next dev`, so attach to it
   rather than starting a second one. Measuring beats squinting — the Panel
   overflow bug in §8 was found with four `getBoundingClientRect()` numbers after
   the reported cause (video duration) turned out to be a red herring.
3. **Numeric checks of the pure modules** via `node -e`, re-implementing the
   expression under test. This is how the fade envelope and the rotation wrap were
   confirmed, including the overlapping-fade case.

**Known limit:** a file `<input>` cannot be driven from outside the browser, so
anything needing a loaded video — the drag, the inspector, the fades — is
**unverifiable by the agent** and must go on the user's checklist. Say so plainly
rather than implying it was tested.

## 5b. M6 — what shipped

M6 gave each overlay its own geometry. The four design decisions were taken as
recommended and are now baked into the code:

1. **Coordinates normalized 0–1** — `x: 0.5, y: 0.85` = "halfway across, 85%
   down". Resolution-independent, so the editor and M8's export agree at any size.
2. **Scale relative to frame HEIGHT** — via `frameScale = frame.height /
   REFERENCE_FRAME_HEIGHT` (450), so at a 450px-tall preview overlays look exactly
   as they did in M5.
3. **Anchor at the overlay's centre** — `translate(-50%, -50%) rotate() scale()`,
   in that order. Order is load-bearing; see Learning.md → Step 2.
4. **Drag-on-video is M6**; dragging clips *along the timeline* is M7.

New/changed model: `ClipTransform { x, y, scale, rotation, opacity }` on
`ClipBase`, plus `fadeIn` / `fadeOut` seconds beside `start` / `duration`
(timing, not geometry). `ClipPatch` gained `transform?`, `fadeIn?`, `fadeOut?`.
`updateClip`'s payload gained an optional `videoDuration` so the reducer can hold
clips inside the footage.

**Explicitly NOT in M6, still open:** keyframed animation (values changing over
time — a much bigger model change), the mouse/arrow/image kinds, timeline
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
  `timelineCoords.ts`, `activeClips.ts`, `newClip.ts`, `overlayCoords.ts`,
  `clipOpacity.ts`. The editor and the renderer must be able to run the same
  function and get the same answer.

Rules learned during M6 — apply them, don't re-derive them:

- **A type system verifies the shape of what you pass, never that anyone read
  it.** Step 1 added `transform?` to `ClipPatch` and Step 2 rendered
  `clip.transform`, but `updateClip` had no branch for `patch.transform` — so the
  first drag dispatched a perfectly valid action that changed nothing. Both sides
  typechecked. When you add a patch field, add its reducer branch in the same
  breath.
- **A percentage needs something definite to be a percentage OF.** `h-full`,
  `max-h-full`, `flex-1`, `min-h-0` are one family; a single `auto` high up
  silently disables all of them below it. `min-h-0` without a height is half a
  fix. See the `Panel.tsx` note in §8.
- **Round where imprecision ENTERS, never where it is displayed.** Rounding a
  controlled input's `value` swallows keystrokes — the KeysField bug in a new
  costume. `roundPosition` runs in the reducer, the one choke point.
- **Build guarded objects field-by-field, not with a spread.** The transform
  block lists all five fields, so a sixth field on `ClipTransform` stops the
  literal compiling until it is given a rule. A spread would let it through
  unguarded.
- **Refuse NaN at the door** (`finiteOr`). NaN in geometry renders as
  `scale(NaN)`: the overlay vanishes and *nothing* reports an error.
- **Choose the operator so the degenerate case handles itself.** `Math.min` in
  the fade envelope means overlapping fade-in/fade-out simply peaks lower —
  no value above 1, no flicker, no validation error, no special case.
- **Some invariants span two fields.** Shrinking `duration` must also shrink
  `fadeIn`/`fadeOut`: no single field was invalid, the *combination* was. Another
  reason invariants belong where the data changes.
- **Lift `pointer-events` selectively.** The overlay container stays
  `pointer-events-none` and each item opts back in with `pointer-events-auto`.
  Removing it from the container makes the whole video frame a click-blocker.
- **Copy shared mutable defaults** (`{ ...DEFAULT_TRANSFORM }`). Handing the
  constant itself into the store lets Redux Toolkit freeze it, and every later
  Reset would be resetting a frozen object.
- **CSS transform order is load-bearing.** `translate(-50%,-50%) rotate() scale()`
  — in that order, because `transform-origin` defaults to the element's centre and
  `translate`'s percentages resolve against its *untransformed* size. Reversed, the
  scale multiplies the -50% shift and every overlay sits half its width off-target.
- **Reproduce by measuring, not by squinting.** The reported cause of the panel
  overflow (long video) and the real cause (a missing class three components away)
  had nothing to do with each other.

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

### Current M6 file map (`frontend/features/timeline/`)

```
types.ts             KeyboardClip | TextClip union, Track, ClipPatch,
                     NewOverlayClip, ClipTransform; fadeIn/fadeOut on ClipBase
timelineSlice.ts     viewport + clip data; setZoom/panBy/zoomAt/fitToWindow/
                     clampViewport + addClip/selectClip/updateClip/deleteClip.
                     updateClip owns ALL invariants: start/duration vs
                     videoDuration, fade ≤ duration, x/y 0–1 + rounded,
                     scale/opacity clamped, rotation folded to one turn
timelineSelectors.ts selectTimeline/Zoom/ViewportStart/Tracks/SelectedClipId,
                     selectSelectedClip (derived: id → the clip object)
timelineCoords.ts    PURE: timeToX, xToTime, tickStep, visibleTicks, clipRect,
                     isRectVisible, minZoomFor, maxViewportStart
overlayCoords.ts     PURE: draggedPosition (pixels → 0–1, mirror of xToTime),
                     roundPosition
activeClips.ts       PURE: isClipActive, activeClipsAt  (half-open interval)
clipOpacity.ts       PURE: clipOpacityAt — fade envelope × base opacity
newClip.ts           PURE: makeNewClip, DEFAULT_CLIP_DURATION, MIN_CLIP_DURATION,
                     DEFAULT_TRANSFORM, MIN_SCALE, MAX_SCALE
components/Timeline.tsx        ruler + lanes + playhead; scrub, wheel zoom/pan
components/TimelineToolbar.tsx + Keys / + Text / Fit  (outside the pointer root)
components/ClipBlock.tsx       one clip as a lane block; click selects
components/OverlayCanvas.tsx   live overlays on the preview; measures the video
                               box; per-clip transform; drag with pointer capture
components/ClipInspector.tsx   Properties form: name/start/length/fades/props
components/TransformFields.tsx X/Y/Scale/Rotation/Opacity sliders + Reset
components/Field.tsx           shared labelled row + INPUT class string
```

Panel layout note (found during M6): `components/layout/Panel.tsx` needs
`h-full` — without it the section is content-height, every percentage height
inside it silently resolves to `auto`, and the video's height ends up driven by
the panel's WIDTH, overflowing into the timeline row.

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
- **`npm run dev` / `npm run build` cannot run on the current machine.** A nested
  PowerShell — one that is itself a child process — is denied permission to launch
  *any* executable here. Verified: `where.exe`, `hostname.exe`, `node.exe`,
  `go.exe` and `rustc.exe` all fail with "Access is denied" from a nested
  `powershell` **or** `pwsh`, while `cmd.exe` launching the identical binary
  succeeds, as does a top-level shell. Both npm scripts route through
  `powershell -File scripts/…`, so both sit exactly on the blocked hop. Likely a
  corporate endpoint policy (this is a domain machine: ACLs show `USB\<user>`);
  `Get-MpPreference` would not load its module and the AppLocker query hung, so
  the rule could not be positively identified without admin.
  Workarounds: `npm run frontend:dev` and `npm --prefix frontend run build` are
  unaffected (no PowerShell in the chain), and `cmd /c "<exe> …"` works.
- **MSVC build tools are NOT installed** on the current machine (no `link.exe`,
  no `cl.exe`, no `vswhere.exe`, no Windows SDK). Rust 1.97.1 + rustup 1.29.0 and
  Go 1.26.5 are present, and Node is v24.11.1. So Rust can compile but cannot
  link — needed before M8. WebView2 runtime 151.0.4129.72 is present.

## 11. Reminders / known deferred items

- M10: Windows force-kill orphan watchdog; also pan-by-dragging the ruler,
  `Ctrl+0` for Fit (needs the measured width inside a hook), tooltips, undo/redo.
  (The zoom-fit *button* itself landed in M4.5.)
- M10: `currentTime` is mirrored from the `timeupdate` event, which fires only
  ~4×/s, so a preview overlay can appear/vanish up to ~250ms late **during
  playback**. Scrubbing is exact and the M8 export evaluates per frame, so this
  is cosmetic. Fix = a requestAnimationFrame mirror.
- ~~Nothing clamps `clip.start` against the video's length.~~ **Fixed in M6
  Step 6**: `updateClip` clamps `start` to `videoDuration - MIN_CLIP_DURATION`
  when the caller passes `videoDuration`. M7's drag and M9's loader must pass it
  too — it is optional in the payload type.
- `frontend/AGENTS.md` is auto-recreated by `next dev`; committing it is fine.
