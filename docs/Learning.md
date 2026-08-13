# GuideForge — Learning Notes

A beginner-friendly, living document that records the *explanations* behind the
code, step by step. Append to it as we build. Read it like notes from a mentor.

## How to use this doc

- Each **Step** corresponds to one component/milestone of work.
- Every step has the same shape: files touched → data flow → concepts → pitfalls.
- **Explain by example.** Abstract rules are paired with a **worked, click-by-click
  walkthrough** (like the video-player walkthrough below) — a concrete trace of
  "what the user does" → "which event fires" → "what the store holds" is worth
  more than a definition. New material should follow that style.
- If you forget how something works, search this file before asking.

---

## Big picture — how the app is wired

Three layers, one flow:

```
React UI (frontend/)  ──HTTP──►  Go backend (backend/)
     ▲                                 │ spawned by
     │                                 ▼
     └───────── Tauri shell (src-tauri/) ──► owns the window, keeps Go alive
```

- **Frontend** = React rendered in a webview. All state lives in Redux.
- **Go backend** = a separate process (sidecar) on `127.0.0.1:3939`. Does heavy
  work (video/rendering later). Started by Tauri when the app opens.
- **Tauri (Rust)** = native window + process manager. You rarely touch it.

### The page-load journey (M1 → M2 so far)

```
npm run dev → http://localhost:3000
  → frontend/app/layout.tsx            root frame (<html><body><Providers>…</Providers>)
      → frontend/app/providers.tsx     mounts <Provider store={store}>  ← store becomes available everywhere
          → frontend/app/page.tsx      renders the whole editor
              → frontend/components/layout/EditorShell.tsx    the single grid everything lives in
                  ├─ MenuBar        (top)
                  ├─ AssetsPanel | divider | PreviewPanel | divider | PropertiesPanel   (middle row)
                  ├─ divider | TimelinePanel                 (bottom)
                  └─ StatusBar      (reads backend status, and fires the health check on mount)
```

Step 6 made the app *look* like the final editor. The demos and the welcome
screen are gone — the app boots straight into the editor shell.

The store sits **above everything**. Any component can `dispatch` (write) or
`useAppSelector` (read) without passing props — that's the whole point of Redux.

---

## Core concepts (glossary)

| Term | Meaning | Where it lives |
|------|---------|----------------|
| Component | A function that returns JSX. The unit of UI. | `frontend/components/`, `frontend/features/*/components/` |
| Props | Inputs passed to a component (`<Panel title="Assets" />`). | component signature |
| Children | The JSX placed *between* a component's tags; slots for content. | `{ children }` prop |
| Client component | Runs in the browser; can use hooks. Marked `"use client"`. | any interactive file |
| Store | The single object holding all app state. | `frontend/store/store.ts` |
| Slice | One feature's state + the rules to change it, in one file. | `frontend/features/*/*Slice.ts` |
| Action | `{ type, payload }` — a description of "something happened". | created by action creators |
| Action creator | Function you call to dispatch, e.g. `resizePanel({ panel, size })`. | `slice.actions` |
| Reducer | Pure rule: `(state, action) → newState`. No side effects. | `slice.reducers` |
| Selector | `(state) => value` — how components read state. | `*Selectors.ts` |
| Dispatch | The verb for sending an action to the store. | `useAppDispatch()` |
| Immer | RTK built-in: lets you write "mutations" safely → real immutability. | inside slices |
| `"use client"` | Directive: this component needs browser APIs / hooks. | top of file |

### The two paths

- **Write:** `dispatch(action)` → store routes by `action.type` → reducer → new state → notify subscribers.
- **Read:** `useAppSelector(selector)` → subscribe → re-run whenever that slice of state changes → re-render.

**One writer, many readers:** usually one component owns the dispatch for a
thing; others just read. Avoid two dispatchers for the same event (e.g. two
health checks on mount).

---

## Milestone 1 — Foundation (done, verified)

- Stack: Tauri (Rust) + React (Next.js static export) + Redux Toolkit + Go.
- Frontend is a **static SPA** (`output: "export"` in `frontend/next.config.ts`);
  Tauri serves the built `out/`.
- Go backend exposes `GET /health` and `GET /version` on `127.0.0.1:3939`
  (`backend/internal/api/api.go`).
- Tauri spawns the sidecar on startup and kills it on exit
  (`src-tauri/src/lib.rs`); Go also exits if its stdin closes (crash-safe).
- Verified end-to-end: window opens → sidecar spawns → `/health` responds.

## Milestone 2 — Steps so far

### Step 1 — MenuBar (`frontend/components/layout/MenuBar.tsx`)

**New concepts:** components, JSX, rendering a list from data with `.map()`.

- `const MENUS = ["File", "Edit", "View", "Help"] as const;`
  - `as const` = keep the *exact* literal strings, not `string[]`.
- `type MenuName = (typeof MENUS)[number];` — type derived from data, can't drift.
- `.map()` turns data → JSX. **Never copy-paste buttons**; data-driven UI.
- `key={item}` is required per list item so React can track it.
- `disabled` on a button dims it (see Export MP4 placeholder).

### Step 2 — StatusBar (`frontend/components/layout/StatusBar.tsx`)

**New concepts:** reading Redux with selectors; extracting shared code (DRY).

- `useAppSelector(selectBackend)` **subscribes** — component re-renders when that state changes.
- Status → style mapping was in `SystemStatusCard`; extracted to
  `frontend/features/system/systemStatusPresentation.ts` and shared by both
  components (single source of truth — "copy twice, extract").
- StatusBar **only reads**. The health check dispatch stays in
  `SystemStatusCard` (one writer). StatusBar reflects changes for free.
- `"use client"` is needed because it uses hooks (MenuBar doesn't).

**Flow:**
```
SystemStatusCard mounts → dispatch(checkBackendHealth())   [write]
  → store → system slice → pending ("checking")
  → backendClient.ts → fetch http://127.0.0.1:3939/health → Go handleHealth → JSON
  → fulfilled → status "connected"
  → store notifies subscribers
StatusBar (read) re-renders → "Connected" green dot
```

### Step 3 — layoutSlice (`frontend/features/layout/`)

**New concepts:** your first slice (state + rules), actions, PayloadAction, Immer, store registration, derived types.

- **Slice anatomy:** `initialState` + `reducers` + `createSlice` → action creators + reducer.
  - `name: "layout"` prefixes action types → `"layout/resizePanel"`.
  - `PayloadAction<T>` = the type contract for `{ type, payload }`.
  - Immer lets you write `state.panels[x] = y` safely (it builds a new object).
- **Store registration:**
  ```ts
  reducer: { system: systemReducer, layout: layoutReducer }
  ```
  `RootState = ReturnType<typeof store.getState>` → adding `layout` makes
  `state.layout` typecheck everywhere automatically. Wiring bugs fail at build time.
- **Selector:** `(state: RootState) => state.layout.panels`.
- `LayoutSizesDemo.tsx` is **temporary** — exists to click + / − and watch state.
  Deleted when real panels arrive.

**Click flow:**
```
click + → dispatch(resizePanel({ panel, size }))
  → action { type: "layout/resizePanel", payload: { panel, size } }
  → store → layout reducer → state.panels[panel] = size
  → notify → LayoutSizesDemo re-renders with new px
```

**Pitfalls to remember:**
- `onClick={() => …}` — the arrow defers execution. Without it, the action fires during render.
- `Object.keys(panels) as PanelName[]` — `Object.keys` returns `string[]`; cast tells TS the real keys.

---

### Step 4 — Panel (`frontend/components/layout/Panel.tsx`)

**New concepts:** props, children (the slot), TypeScript prop types, composition.

- **Props = inputs.** `<Panel title="Assets" />` passes `title` into the component.
  The type is declared with an `interface`:
  ```ts
  interface PanelProps { title: string; children: ReactNode; }
  export function Panel({ title, children }: PanelProps) { … }
  ```
  Destructuring `{ title, children }` unpacks the props object.
- **Children = the slot.** Everything between `<Panel>…</Panel>` becomes
  `children`. One `Panel` renders a title bar + an arbitrary body. That's why
  AssetsPanel (a list) and PropertiesPanel (a message) look different but share
  the same chrome (border, header, padding).
- **Reusable before clever:** write one generic component, customize via
  props + children. Never copy the panel markup into each feature.

**Flow (composition):**
```
page.tsx renders (temp demo row):
  <div class="w-60"><AssetsPanel /></div>      ← gives width to the panel
  <div class="w-72"><PropertiesPanel /></div>
       ↓
AssetsPanel → <Panel title="Assets"> …list… </Panel>
       → Panel header renders {title} = "Assets"
       → Panel body renders {children} = the <ul> list
```

**Pitfall hit live:** `const x = [...] as const` makes a *tuple* — element types
are literal and `.length` becomes a literal number (`4`). So
`PLACEHOLDER_ASSETS.length === 0` failed typecheck ("types '4' and '0' have no
overlap"). Use `: string[]` when you need a real array length check.

**Review answer:** `resetLayout` exists (though unused) to document the slice's
API and give an escape hatch once dividers clamp sizes.

### Step 5 — PanelDivider (`frontend/components/layout/PanelDivider.tsx`)

**New concepts:** pointer events, drag math, `useRef`, `setPointerCapture`,
dispatching actions *in response to a drag*.

- **Pointer events** — `pointerdown` / `pointermove` / `pointerup` / `pointercancel`
  are the modern, mouse+touch unified event trio (don't use `mousedown`/`mousemove`).
- **`setPointerCapture`** — after `pointerdown`, ALL pointer events are routed
  to this element even outside it. Without it, a fast drag "loses" the divider.
- **`useRef`** — stores values that survive re-renders *without* re-rendering.
  `dragStart = { x, size }` is captured at press time, so the anchor never
  drifts as `size` changes on each move.
- **Drag math:** `next = startSize + (clientX − startX)`, then `clamp(next, 160, 600)`.
  `clamp` extracted to `frontend/utils/clamp.ts` (reusable).
- **Panels are now state-driven:** widths come from `selectPanels`, so dragging
  a divider dispatches `resizePanel` and the panel width follows the state.

**Drag flow:**
```
pointerdown → record {x, size} in refs, setPointerCapture
pointermove (repeat) → next = start.size + dx → dispatch(resizePanel) → store → re-render
pointerup / pointercancel → stop
```

**Stepping stone:** `LayoutPreview` (features/layout/components) composes
panels + dividers for the demo. Replaced by `EditorShell` in Step 6.

### Step 6 — EditorShell (`frontend/components/layout/EditorShell.tsx`)

The "final assembly". One grid contains the whole app; every panel is a real,
resizable part of the screen.

**New concepts:** CSS Grid (`grid-template-areas`, `gridArea`, rows in `fr`/px),
layout driven entirely by state, retiring dead code, the single-owner rule.

- **CSS Grid** — the layout engine for 2-D pages. You declare rows/columns and
  each child says *which cell it lives in*:
  ```
  gridTemplateAreas: "menubar" "main" "timeline" "statusbar"   ← names the rows
  gridTemplateRows:  36px  minmax(0,1fr)  ${panels.timeline}px  28px
  each child:  style={{ gridArea: "menubar" }}                  ← claims its row
  ```
  `minmax(0, 1fr)` = "take all leftover space, but allow shrinking to 0"
  (without the `0`, overflow breaks `flex`/`grid` children).
- **Timeline height is state-driven too** — the row size is `panels.timeline`,
  so the timeline is resizable by dragging a *horizontal* divider. That's why
  `PanelDivider` gained an `orientation` prop: "vertical" drags width
  (`clientX`), "horizontal" drags height (`clientY`). Same drag math, different axis.
- **Middle row uses `flex`, not grid** — because three of its columns come from
  state (`width: panels.assets`, etc.) and the preview is "everything left".
  Mixing: grid for the big 4-row frame, flex inside the row that resizes.
- **Retiring demos is a real skill** — `LayoutSizesDemo`, `LayoutPreview`,
  `HelloGuideForge`, and `SystemStatusCard` were deleted. Before deleting,
  grep for imports to be sure nothing else uses them (only `page.tsx` did).
  Dead code is a liability: it rots, and it confuses future you.
- **Single owner rule applied** — `SystemStatusCard` used to fire the backend
  health check. With it gone, `StatusBar` (the only reader) took over the
  dispatch in a `useEffect`. Exactly one component owns each side effect now.

**Data flow:**
```
page.tsx
  └─ <EditorShell/> (reads panels via selectPanels)
       ├─ <PanelDivider panel="assets">       drag → resizePanel({assets, w})
       ├─ <PanelDivider panel="properties">   drag → resizePanel({properties, w})
       └─ <PanelDivider panel="timeline" orientation="horizontal">  drag → resizePanel({timeline, h})
```
Only the dividers *write*; the shell *reads* the same state and re-renders all
three panels. Still the Step 3 pattern: **one writer, many readers, store in
between.**

**Pitfall:** grid rows with `minmax(0,1fr)` — always pair with `min-h-0`
(`min-h-0` = `min-height: 0`, lets a child actually shrink) on grid/flex
children that contain panels, or the timeline/preview will overflow instead
of squeezing.

### Step 7 — Menus + final wiring (`frontend/components/layout/MenuBar.tsx`)

Step 7 closes the loop on M2: make the menus *do something*, and verify the
whole stack.

**New concepts:** drop-down menus, "click outside to close" via `useRef` +
`document` listener + `contains`, enabling/disabling items from data, the last
orphaned action is finally used.

- **Orphaned action:** `resetLayout` existed in the slice (Step 3) but nothing
  dispatched it once `LayoutSizesDemo` was deleted — dead state is the first
  sign of leftover logic. Wiring it into a menu item (View → Reset Layout) is
  the cleanup.
- **Menus became data-driven** (same idea as the top bar in Step 1): `MENUS`
  is now an array of `{ name, items: [{ label, shortcut?, action? }] }`.
  Only items with an `action` are enabled; the rest render disabled with a
  hint of their future purpose (Open Video → M3, Export MP4 → M8).
- **Dropdown pattern:** a `useEffect` listens for `mousedown` on `document`
  while a menu is open; if the click is *outside* `barRef.current` (the whole
  header), close the menu. `Node.contains(target)` is the "is this inside?"
  check. This is the standard way to do "click outside to dismiss".
- **Action routing:** `onItemClick` dispatches based on `item.action`. One
  `dispatch(resetLayout())` — the full write path from a menu to the store to
  every panel re-rendering.
- **Verification:** `npm run frontend:build` (TypeScript) passed; the Go
  backend was started and answered `GET /health` → `{status:"ok"}` and
  `/version` → `{version:"0.1.0"}` from the freshly-built sidecar.

**Pitfall (Windows + Tauri, matches the known M10 issue):** a previous
`npm run dev` was killed and it **left orphaned processes** —
`guideforge.exe` and `guideforge-backend.exe` kept running, still owning port
3939. That is the force-kill-orphans problem we deferred to M10. Diagnose
with `Get-CimInstance Win32_Process -Filter "Name like 'guideforge%'"` and
clean up with `Stop-Process -Id <pid> -Force`.

## Milestone 3 — Video Player

Goal: open an MP4, play/pause, seek, and see the current time — without the
UI ever feeling blocked. The `<video>` element stays the source of truth for
playback; Redux keeps a throttled mirror the UI reads from.

### Step 1 — `playerSlice` + store registration
(`frontend/features/player/playerSlice.ts`, `playerSelectors.ts`,
`frontend/store/store.ts`)

**New concepts:** a third slice; what a *player* needs in state; the store is
now a map of slices.

- **Shape choices:** `status: "empty" | "ready"` (has anything loaded?);
  `sourceUrl` + `fileName` (what's open); `isPlaying`, `currentTime`,
  `duration` (the mirrored playback state); `pickRequest` (a counter used only
  as a *signal* — "bump me and I'll open the file dialog").
- **`videoOpened`, `clearVideo`** — load/unload. Note the reducer does NOT
  revoke the old object URL: that's a side effect and a reducer must stay
  pure. The component handles it when opening the next file.
- **`setTime`/`setDuration`** — mirrors what the `<video>` reports. The video
  element remains the owner of real playback; Redux just reflects it.
- **Registered in the store** alongside `system` and `layout`. ConfigureStore
  keys the state by slice name, so everywhere it's `state.player`.

**Why this ordering:** build the data model first, UI second. Step 2 will
start filling `status`/`sourceUrl` by opening a real file.

### Step 2 — Open a video (`features/player/components/VideoPicker.tsx`, MenuBar, PreviewPanel)

**New concepts:** using the store as a *signal*; `<input type="file">`;
object URLs; where side effects must live.

- **Signal, not data:** the menu bar can't open a dialog by itself, and the
  picker can't know when the menu was clicked. So the MenuBar just dispatches
  `requestPick()` which bumps `player.pickRequest`. The `VideoPicker` — the
  **single owner** of the real `<input>` — watches that value in a `useEffect`
  and calls `inputRef.current.click()` when it changes. One writer, one
  reader, the store in between. Same pattern as the panels.
- **`<input type="file" accept="video/*">`** is hidden (`className="hidden"`)
  but its `.click()` still opens the OS file dialog. `accept="video/*"` hints
  the picker to show video files.
- **Object URLs:** `URL.createObjectURL(file)` returns a `blob:` URL the
  `<video>` element can play without loading the whole file into memory. It is
  a *lease* on memory — always `URL.revokeObjectURL(oldUrl)` when replacing,
  or you leak.
- **Why the revoke lives in the component, not the reducer:** revoking a URL
  is a side effect, and reducers must stay **pure** (same input → same output,
  no I/O). Components own side effects (revoking, calling `.click()`, DOM),
  reducers compute new state. This stays true the whole project.
- **Reset `event.target.value = ""`** after reading the file, so selecting the
  *same* file again re-triggers `onChange`.
- **Wiring the disabled item:** the File → Open Video menu item got
  `action: "openVideo"` and `MenuAction` gained `"openVideo"`. `onItemClick`
  now dispatches `requestPick()` for it. The menu is genuinely useful now.

**Flow:**
```
File → Open Video (or empty-state button)  →  dispatch(requestPick())
  → VideoPicker: pickRequest changed       →  input.click() → OS picker
  → onChange: revoke old URL → objectURL → dispatch(videoOpened({fileName, sourceUrl}))
  → store.player = { status:"ready", sourceUrl: blob:…, fileName }
  → PreviewPanel re-renders and shows the file name.
```

### Step 3 — Preview + transport controls
(`features/player/components/VideoPlayer.tsx`, `TransportBar.tsx`,
`formatTime.ts`)

**New concepts:** owning a native element via ref + mirroring its events into
the store; the two-way bridge; controlled seek with a drag "draft"; why the
element, not Redux, keeps the clock.

- **Two one-way bridges.** The element is the source of truth for playback.
  - *Element → store:* `useEffect` attaches listeners — `loadedmetadata`
    → `setDuration`, `timeupdate` → `setTime`, `play`/`pause` → `setPlaying`,
    `ended` → pause. The element drives; Redux mirrors.
  - *Store → element:* a second effect watches `isPlaying`; when it flips it
    calls `video.play()`/`video.pause()` on the element. The events echo the
    change back to the store — **no loop**, because dispatching the same value
    doesn't re-render.
- **User clicks play/pause directly on the element** (`video.paused` → play
  or pause). The store learns via the `play`/`pause` events. The button icon
  therefore always reflects reality.
- **The seek "draft":** while dragging the range thumb, `timeupdate` keeps
  echoing the element's *real* time, which would yank the thumb back. So the
  bar tracks a local `draft` while the pointer is down; the display shows
  `draft ?? currentTime`, and `draft` clears on release. Live-seek fires
  `onSeek(v)` on every change.
- **`formatTime`** — tiny pure helper `seconds → "m:ss"`. `padStart(2, "0")`
  guarantees two digits.
- **Presenter vs. owner:** `TransportBar` knows nothing about the `<video>`.
  It receives `onTogglePlay`/`onSeek` callbacks + reads mirrored values, so it
  stays reusable/presentational. `VideoPlayer` owns the element + the refs +
  the DOM work.

**Pitfall (TypeScript):** inside a `useEffect`, `videoRef.current` is typed
`HTMLVideoElement | null`. The guard `if (!video) return` narrows it, but the
narrowing is **lost inside nested closures** (the event handlers), so
`video.duration` errors as "possibly null". Fix: capture `const el =
videoRef.current!` — the `!` asserts non-null (safe: the ref is always
attached by effect time). This "narrowing doesn't cross into closures" rule
applies to `let`/`const` of nullable refs.

**Flow:**
```
<video> loadedmetadata → dispatch setDuration → seekbar knows the max
<video> timeupdate    → dispatch setTime     → readout + thumb follow
Play button / isPlaying effect → video.play() → play event → isPlaying=true
```

### Worked example — one video, five actions (upload, play 5s, pause, seek, play)

The whole player is a loop between **three players**: the native `<video>`
(truth), the Redux `player` slice (mirror), and the views that subscribe
(`TransportBar`, `PreviewPanel`). Trace it click by click.

Initial store:
```
player = { status:"empty", sourceUrl:null, fileName:null, isPlaying:false, currentTime:0, duration:0, pickRequest:0 }
```

**1) Upload**
```
You click "Open a video…"  →  dispatch(requestPick())  →  pickRequest 0→1
VideoPicker useEffect (watches pickRequest) → inputRef.click() → OS dialog
You pick myVideo.mp4 → onChange → URL.createObjectURL(file) → blob:…
  → dispatch(videoOpened({fileName, sourceUrl: blob}))
store.player: { status:"ready", sourceUrl:"blob:…", fileName:"myVideo.mp4" }
```
PreviewPanel sees `status === "ready"` → renders `<VideoPlayer sourceUrl="blob:…"/>`.

VideoPlayer mounts → **effect #1 runs:**
```
el.src = blob:…   → browser starts fetching/parsing the MP4
   └─ pipeline reads header → fires loadedmetadata → dispatch setDuration(60)
```
(You'd see the log `[log] loadedmetadata — duration: 60`.)

**2) Play for 5s**
```
You click ▶ → TransportBar onTogglePlay → VideoPlayer.togglePlay()
   video.paused === true → video.play()
        browser buffers, starts its clock, THEN fires play
        → onPlay → dispatch setPlaying(true)
store: isPlaying: true
every ~15–250ms the clock advances, firing timeupdate → setTime(v)
   currentTime streams 0 → 5; the readout and thumb follow each event.
```
After 5s: `store = { isPlaying:true, currentTime:≈5, duration:60 }`

**3) Pause**
```
You click ⏸ → togglePlay → video.paused === false → video.pause()
   browser stops the clock → fires pause → setPlaying(false)
Clock stops → no more timeupdate. currentTime stays ≈5 → readout sits at "0:05".
```

**4) Drag the seekbar to 1 minute**
```
Press the thumb    → onPointerDown → draft = currentValue (≈5)
Drag               → onChange(60) → setDraft(60)   ← display shows 1:00 (draft overrides)
                                    → onSeek(60) → el.currentTime = 60
   browser jumps the playhead → fires timeupdate → setTime(60)
   (more echoed timeupdates keep coming, but the draft holds the thumb put while you drag)
Release the thumb  → onPointerUp → setDraft(null) → display falls back to currentTime (≈60)
```
Store now: `{ isPlaying:false, currentTime:60, duration:60 }`

**5) Play again**
```
You click ▶ → togglePlay → video.play() → fires play → setPlaying(true)
   stream of timeupdate resumes from 60 onward.
```

**The takeaway:** you act on the element (`play()`, `currentTime =`), the
element's pipeline reports reality through events, your handlers translate
those events into `dispatch`, and every subscribed view re-renders from the
store. The store never drives playback — it always *reflects* it. Seeking
"just" assigns `currentTime`; everything after that is the element
re-reporting to the store.

### Step 4 — Keyboard shortcuts
(`features/player/hooks/usePlayerShortcuts.ts`, `playerSlice` `seekBy`,
VideoPlayer seek bridge)

**New concepts:** a global keydown listener; commands vs. mirrors in state;
the seek command bridge.

- **Where it lives:** a hook called once in `EditorShell`, so it's active
  app-wide. It only ever `dispatch`es — it has no access to the `<video>`.
- **Guard:** skip any key if focus is in an `INPUT`/`TEXTAREA`/`SELECT` or
  `contentEditable`, so we never hijack the user's typing.
- **Space = play/pause:** `dispatch(setPlaying(!isPlaying))`. It works *only when a video
  is loaded* (`status === "ready"`), because opening the dialog on an empty
  app would be annoying.
- **←/→ = ±5s:** `dispatch(seekBy(±5))` (+0.1s with Shift). This is a
  **command**, not a display update — the element owns the playhead.
- **Ctrl/Cmd+O = open:** reuses the same `requestPick()` signal the menu uses.
- **Command vs. mirror:** `setTime` is a *mirror* (written by `timeupdate`);
   `seekBy` is a *command* (wants to move the element). The two must never be
    confused, which is why seeking keeps separate `seekRequest`/`seekTime`
    fields.

**The seek bridge (store → element, matching `isPlaying`):**
```tsx
// slice:  seekBy(±5) → currentTime+seekTime=target, seekRequest+1
// VideoPlayer effect:
useEffect(() => {
  if (seekRequest > 0) {
    const video = videoRef.current!;
    video.currentTime = seekTime;      // the actual move
  }
}, [seekRequest, seekTime]);
```
The element's `timeupdate` then echoes the new position back into `setTime`
for the display. Same two-bridge idea as Step 3, now for seeking.

### Step 5 — M3 verification pass

The wiring was already done in Steps 1–4 (shortcuts in `EditorShell`, player
in `PreviewPanel`), so Step 5 is the acceptance gate:

- **Full production build:** `npm run build` → Go sidecar rebuild + Next
  static export (TypeScript clean) + Rust release binary + MSI/NSIS
  installers. All green.
- **Live backend check:** started the freshly-built sidecar and hit
  `GET /health` → `{status:"ok", app:"GuideForge Backend"}` and
  `GET /version` → `{version:"0.1.0"}`.
- **Pitfall surfaced again:** a stray `guideforge-backend.exe` (orphan from an
  earlier killed `npm run dev`) was still holding port 3939, so the fresh
  instance failed to bind — but the requests were answered by the living one,
  proving the contract. Cleanup killed all `guideforge*` processes. Same
  Windows force-kill orphan issue as M2 Step 7 (deferred fix lives in M10).

**M3 acceptance met:** open an MP4 (menu, button, or Ctrl+O) → live preview →
play/pause/seek (mouse + keyboard) → current time readout → UI never blocked
(the element decodes off the UI thread).

## Milestone 4 — Timeline Engine

The timeline is a *viewport* onto the video's time axis. Everything is measured
in **seconds** (absolute time); pixels are derived. `player.currentTime` stays
the single source of truth for the playhead; a new `timeline` slice owns only
the viewport (zoom + pan) — which is UI state, never saved.

### Step 1 — `timelineSlice` + store registration
(`features/timeline/timelineSlice.ts`, `timelineSelectors.ts`, `store.ts`)

**New concepts:** a fourth slice; viewport state vs. data; zoom = px per second.

- **Shape:** `{ zoom, viewportStart }`. `zoom` = how many *pixels one second*
  occupies (bigger = more zoomed in). `viewportStart` = the second shown at the
  left edge of the timeline (the pan position).
- **Why zoom/pan live in Redux but are never saved:** they're *presentation*
  — different users like different zoom. The project format stores absolute
  time only. Viewport state is rebuilt from `DEFAULT_ZOOM` on open.
- **Clamped:** `setZoom` clamps to `[4, 400]`; `panBy`/`setViewportStart` never
  go below `0`. Reusing `clamp` from `utils/clamp`.
- **Three small actions for now:** `setZoom`, `panBy(±s)`, `setViewportStart`
  (direct). Steps 3–5 will consume them; Step 5 adds the anchored `zoomAt`.

### Step 2 — Coordinate helpers (`features/timeline/timelineCoords.ts`)

**New concepts:** pure math functions; the time↔pixel formulas; "nice" tick
steps; float-drift avoidance.

- **`timeToX(t, viewportStart, zoom)`** = `(t − viewportStart) * zoom` — where
  a second appears on screen. **`xToTime(x, viewportStart, zoom)`** =
  `viewportStart + x / zoom` — the inverse (what the cursor is pointing at).
  Everything else in the timeline is built on these two.
- **`tickStep(zoom, minPx = 60)`** — from a fixed list of "nice" steps
  (`0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 60, …`), return the smallest step whose
  pixels (`step * zoom`) meet a minimum label spacing. Zoomed way in → fine
  ticks (0.1s); zoomed out → coarse ticks (60s). The ruler never crowds.
- **`visibleTicks(...)`** — the actual second-values to draw across a viewport,
  computed with `Math.ceil(start/step)` … `Math.floor(end/step)` and an
  **integer loop counter** (`i * step`), so floating-point error can't
  accumulate over a 30-minute timeline (that's why we don't do `t += step`).
- **`r2`** — rounds to 2 decimals to hide artifacts like `0.30000000000000004`.
- **Why pure:** no React, no store — pure functions are trivially testable and
  reusable; the ruler and the playhead both call the same math, so they can
  never disagree.

**Worked micro-example (5s, zoom 40, viewport 0):**
```
timeToX(5, 0, 40)   → 200        (second 5 is 200px right of the left edge)
xToTime(200, 0, 40) → 5          (200px in means second 5 — round trip works)
tickStep(40)        → 2          (0.5→20px, 1→40px, 2→80px ≥ 60 → step = 2)
visibleTicks(0, 500, 40) → [0, 2, 4, 6, 8, 10]  (every 2s across 12.5s of view)
```

### Step 3 — The `Timeline` component
(`features/timeline/components/Timeline.tsx`, `TimelinePanel.tsx` slimmed to a
slot)

**New concepts:** three-layer timeline; measuring width with
`useLayoutEffect` + `ResizeObserver`; "the playhead is a view of the video
clock, the ruler is a view of zoom."

The component draws three layers in one relative container: an adaptive
**ruler** (ticks + labels), an empty **tracks** area (M5), and an absolute
**playhead** line spanning both. Every pixel position is `timeToX(...)` — one
formula, one truth.

**Read path:**
```tsx
const { currentTime } = useAppSelector(selectPlayer);       // the video's clock
const { zoom, viewportStart } = useAppSelector(selectTimeline);
const ticks     = visibleTicks(viewportStart, width, zoom);
const playheadX = timeToX(currentTime, viewportStart, zoom);
```
Two responsibilities: *what time is it* (from `player`, driven by the element
— M3) and *how zoomed/panned* (from `timeline`, viewport only).

**Width measurement:** `width` starts at 0; `useLayoutEffect` measures
**before paint** (no empty-ruler flicker); `ResizeObserver` re-measures on any
size change (divider drag, window resize).

**Worked example (60s video, zoom 40 px/s, viewportStart 0, timeline 800px):**
```
A) The ruler draws itself:
     tickStep(40): 0.5→20px, 1→40px, 2→80px ≥ 60 → step = 2
     end = 0 + 800/40 = 20s → ticks [0, 2, 4, …, 20], each at (t−0)*40 px
B) Press play → timeupdate mirrors currentTime=5 → playheadX = 5*40 = 200px
   The red line glides every timeupdate (~15–250ms) — no extra code.
C) Pause, drag the timeline divider wider → ResizeObserver → width=1200
   → ticks now [0, 2, …, 30]; playhead stays at second 5 (same time, more room).
```
**Pitfall (TS, same as M3):** `rulerRef.current` is nullable; the narrowing
from `if (!el) return` is lost inside the `ResizeObserver` callback closure.
Fix: `const el = rulerRef.current!`.

### Step 4 — Playhead drag to seek
(`Timeline.tsx` pointer handlers, `playerSlice.seekTo`)

**New concepts:** the absolute seek command; screen coordinates vs. local
coordinates; pointer capture on the timeline.

- **`seekTo(seconds)`** — absolute sibling of M3's relative `seekBy`. Same
  command bridge (`seekTime` + `seekRequest`); `VideoPlayer` applies it to the
  element. Reuses everything from M3.
- **`scrubbing` is a ref, not state** — flipping a boolean we don't render must
  not re-render the whole timeline every pointermove.
- **`xToTime` is the exact inverse of the playhead's `timeToX`** — that
  symmetry is why clicks always land under the cursor.

**Worked example (zoom 40, viewportStart 0, paused at 3s, want second 10):**
```
1. Click at 400px from the timeline's left edge.
2. scrubTo: localX = clientX − rect.left = 400
   → xToTime(400, 0, 40) = 400/40 = 10s
3. dispatch(seekTo(10)) → currentTime=10, seekTime=10, seekRequest+1
4. VideoPlayer effect → video.currentTime = 10      (element jumps)
5. timeupdate echoes → setTime(10) → store mirrors back
6. Playhead re-renders at timeToX(10, 0, 40) = 400px — under your cursor
```
Dragging (even while playing) re-runs 2–6 on every `pointermove`, live-scrubbing
the video; pointer capture keeps the drag alive outside the element.

**Safety:** `seekTo` clamps to `[0, duration]`; the handlers are gated on
`status === "ready"`.

### Step 5 — Zoom on wheel + horizontal pan
(`timelineSlice.zoomAt`, `Timeline.onWheel`)

**New concepts:** anchored (cursor-centered) zoom; viewport re-alignment math;
wheel = pan vs. zoom.

- **Anchored zoom:** naive zoom pivots about the left edge; proper editors zoom
  about the cursor. So:
  ```
  anchorTime = viewportStart + anchorX / oldZoom   // second under cursor (before)
  newZoom    = clamp(zoom * factor)                 // zoom
  viewportStart = anchorTime − anchorX / newZoom    // re-align so it stays put
  ```
- **Wheel routing:** horizontal delta (or Shift held) → `panBy(deltaX / zoom)`
  (px → seconds). Vertical delta → `zoomAt({ factor, anchorX })` with
  `factor = 1.0015 ** −deltaY` (smooth curve).
- **Pure viewport math:** zoom/pan only touch `timeline` state — the video,
  playhead, and clips (absolute time) are untouched. Data vs. view stays
  clean, per the ProjectFormat "absolute times only" rule.

**Worked example (zoom 40, viewportStart 0, cursor at 200px, on "0:05"):**
```
Zoom in (factor 1.2):
  anchorTime = 0 + 200/40 = 5
  newZoom = 48;  viewportStart = 5 − 200/48 ≈ 0.83
  Check: timeToX(5, 0.83, 48) = (5−0.83)·48 = 200px ✓ pinned to cursor

Pan right 240px:
  panBy(240/40 = 6) → viewportStart = 6  (window now shows from second 6)
  Playhead at 5s moves to timeToX(5, 6, 40) = −40px → off-screen left, but the
  video is untouched — only the view moved.
```

### Step 6 — M4 verification pass

- **Full production build:** green — Go sidecar, Next static export + TypeScript,
  Rust release binary, MSI/NSIS installers.
- **Acceptance met:** playhead renders + drags to a second, wheel zooms toward
  the cursor, ruler ticks adapt to zoom, horizontal scroll pans, and the whole
  thing stays smooth because rendering is `O(visible ticks)` (only the ticks
  currently on screen are drawn — the ≥60px step bounds the count).
- Deferred: pan-by-dragging the ruler (would fight the scrub-drag); tooltips;
  a zoom-to-fit button.

**The whole M4 in one line:** the video's own clock (via `player.currentTime`)
feeds the playhead; the `timeline` slice only holds *how you look* (zoom + pan);
`timeToX`/`xToTime` are the only bridge between the two.

## Milestone 5 — Overlay Engine

Put *things* on the time axis: overlay clips (keyboard, text) that appear as
**blocks on lanes** and as **drawn labels on the preview** while the playhead
is inside them.

### Step 1 — The clip/track model
(`features/timeline/types.ts`, `timelineSlice.ts`)

**New concepts:** the data model; discriminated unions; reducers that mint ids
and patch nested objects.

- **Types** (`types.ts`): `OverlayClip { id, kind, name, start, duration, props }`
  — all time absolute seconds. `props` is a **discriminated union**: `kind` is
  the discriminant. `"keyboard"` → `{ keys }`; `"text"` → `{ text, color }`.
  `Track { id, name, clips }`. No pixels anywhere — M9 will serialize this.
- **The slice now has data + view** (both concerns): `zoom`/`viewportStart`
  for the view, `tracks` + `selectedClipId` for the content.
- **`addClip`** mints the id via `crypto.randomUUID()` *inside the reducer*
  (this is the standard RTK pattern — callers just send the content), pushes
  onto the first track and auto-selects. `updateClip` applies a `ClipPatch`
  (every field optional); `deleteClip` filters it out and clears selection.
- **`findClip`** — tiny pure reducer helper so `updateClip`/`deleteClip`
  don't repeat the search loop.

**Worked example — the user adds their first note:**
```
You click "+ Add" (Step 4) → dispatch(addClip({
  kind:"text", name:"Echo!", start:12, duration:3,
  props:{ text:"Echo up", color:"#ffffff" } }))
  → reducer: clip = { id:"5f4…", …payload }  →  tracks[0].clips.push(clip)
  → selectedClipId = "5f4…"
Store: tracks = [ { name:"Overlays", clips:[ { id:"5f4…", kind:"text", start:12,
         duration:3, props:{…} } ] } ], selectedClipId:"5f4…"
```
The plan: Steps 2–3 render that clip as a lane block + preview label; Step 4
builds the "+ Add" button.

## M4.5 — Viewport limits (interlude)

Found while testing a real 22-minute recording: **only the first ~8 minutes were
reachable.** Not a bug in the formulas — an arithmetic collision between two
constants.

### Step 1 — Duration-aware zoom floor, right-hand pan clamp, Fit button
(`timelineCoords.ts`, `timelineSlice.ts`, `components/Timeline.tsx`)

**The diagnosis.** Visible span is always `width / zoom`. The old floor was a
hardcoded `ZOOM_MIN = 4`, and the timeline row spans the whole window (~1900px):

```
1900 px ÷ 4 px/s = 475 s = 7 min 55 s   ← the "8 minutes"
```

To fit 1320 s you need `1900/1320 = 1.44` px/s — below the floor, so the clamp
silently refused. Second bug: `panBy` only had `Math.max(0, …)`, i.e. a **left**
guard rail and no **right** one, so you could pan to second 9000 of a 1320-second
video and stare at an empty grid.

**New concepts:**

- **A limit can depend on data another slice owns.** `duration` lives in the
  *player* slice; `width` is measured from the *DOM*. The timeline reducer can
  see neither — and must stay pure, so it can't go looking. Three ways out:
  1. duplicate `duration` into the timeline slice (two copies of one truth — no)
  2. use a thunk that reads `getState()` (works, but hides the dependency)
  3. **make the caller pass it in the payload** ← chosen
  So every viewport action now carries `bounds: { duration, width }`. The
  dependency becomes visible in the type signature, and the reducer stays a
  pure function of `(state, action)`.
- **Derived limits, not stored ones.** `minZoomFor(bounds)` and
  `maxViewportStart(bounds, zoom)` are pure functions computed on demand. Nothing
  is cached, so nothing can go stale when the window resizes.
- **The two limits agree by construction.** `minZoom = width/duration`, and at
  that zoom `maxViewportStart = duration − width/(width/duration) = 0`. Fully
  zoomed out therefore *always* means "pinned at 0:00, whole video on screen" —
  we didn't have to special-case that, the algebra produces it.
- **Idempotent repair action.** `clampViewport` doesn't change a legal viewport;
  it only drags an illegal one back in range. That makes it safe to fire from an
  effect on every width change without guarding.
- **Effect that must NOT re-run its main job.** The same effect fits a *new*
  video and re-clamps everything else. `fittedFor` (a ref holding the last
  `sourceUrl` we fitted) is the latch — otherwise every window resize would reset
  the user's zoom. A ref, not state, because changing it must not re-render.

**Worked example — opening the 22-minute file (panel 1900px):**
```
videoOpened → sourceUrl="blob:…9c2"     (duration still 0)
<video> loadedmetadata → setDuration(1320)
  → Timeline re-renders; effect deps [sourceUrl, duration, width] changed
  → fittedFor.current (null) !== "blob:…9c2"  → dispatch(fitToWindow(bounds))
  → minZoomFor({1320, 1900}) = 1900/1320 = 1.44 px/s
Store: zoom = 1.44, viewportStart = 0
Ruler: tickStep(1.44) → first step with step*1.44 ≥ 60 is 60 → a label a minute
Result: 0:00 … 22:00 all on screen at once.
```
Then you wheel-zoom in on 15:00 and shift-scroll right to the end:
```
panBy({ seconds: +400, bounds })  with zoom=40
  → clampStart(1200+400, 40, bounds)
  → maxViewportStart = 1320 − 1900/40 = 1320 − 47.5 = 1272.5
  → viewportStart = 1272.5   (not 1600 — the end sticks to the right edge)
```

**Pitfalls hit:**

- `clamp(v, min, max)` misbehaves if `min > max`, so `minZoomFor` clamps its own
  result into `[0.5, 400]` before it is ever used as a lower bound.
- The **Fit** button sits inside the ruler, whose parent owns `onPointerDown`
  for playhead scrubbing. Without `onPointerDown={e => e.stopPropagation()}` the
  click would fit *and* seek the video to wherever the button happens to be.
- No video open (`duration = 0`) or not yet measured (`width = 0`) means we don't
  know the limits — `hasBounds()` gates that and falls back to the old `4` px/s
  rather than dividing by zero.

**Still deferred to M10:** `Ctrl+0` for Fit (needs the measured width inside a
hook), pan-by-dragging the ruler, and a scrollbar/overview strip.

### Step 2 — Clips as lane blocks
(`timelineCoords.ts`, `components/ClipBlock.tsx`, `components/Timeline.tsx`)

**New concepts:** rendering data through the coordinate system; presentational
("dumb") components; `Record<Union, T>` as an exhaustive lookup; culling; event
propagation between overlapping click targets.

- **`clipRect(start, duration, viewportStart, zoom)`** — the second half of the
  time→pixel story. `x` is just `timeToX(start)`; `width` is `duration * zoom`,
  the same px-per-second conversion applied to a *length* instead of a *point*.
  Kept pure in `timelineCoords` because M7's drag/resize needs the identical
  numbers.
- **`MIN_CLIP_WIDTH = 4`** — a 0.2s clip at 1.44 px/s is 0.29px: invisible and
  unclickable. We widen the **drawing** only; `clip.duration` is never touched.
  Cosmetics must not leak into data (the ProjectFormat rule again).
- **`isRectVisible`** — same culling idea as `visibleTicks`. A guide with 500
  overlays still only builds DOM for the few on screen.
- **`ClipBlock` is presentational.** It does no math and reads nothing from the
  store — the parent computes `x`/`width` and passes them down. All coordinate
  logic stays in one file instead of spreading through the tree.
- **`KIND_STYLES: Record<OverlayKind, string>`** — a lookup, not an if/else.
  `Record` over a union is *exhaustive*: the day we add `"arrow"` to
  `OverlayKind`, TypeScript errors here until we give it a colour. The compiler
  becomes the to-do list.
- **Lanes are absolutely positioned by index** (`top: i * TRACK_HEIGHT`), so
  track order = vertical order = the z-order the renderer will use in M8.

**Worked example — the seed keyboard clip at 22:00-video zoom:**
```
clip = { start: 4, duration: 2, kind:"keyboard", name:"Q → E swap" }
viewport after Fit: zoom = 1.44 px/s, viewportStart = 0

clipRect(4, 2, 0, 1.44)
  x     = (4 - 0) * 1.44          = 5.76 px
  width = max(2 * 1.44, 4) = max(2.88, 4) = 4 px   ← the minimum kicked in
isRectVisible({5.76, 4}, 1900) → 5.76+4 ≥ 0 and 5.76 ≤ 1900 → true
→ <button style="left:5.76px; width:4px"> — a visible sliver

Now wheel-zoom to 60 px/s, viewportStart = 3:
  x     = (4 - 3) * 60 = 60 px
  width = max(2 * 60, 4) = 120 px      ← readable block, label fits
```
Nothing in the store changed between those two — only `zoom`/`viewportStart`.
The clip data was identical both times.

**Worked example — clicking a clip:**
```
pointerdown on ClipBlock
  → event.stopPropagation()          (parent's onPointerDown never runs)
  → dispatch(selectClip("seed-keys"))
Store: selectedClipId = "seed-keys"
  → Timeline re-renders → that block gets `ring-1 ring-white/80`
  → video does NOT seek, scrubbing.current stays false

pointerdown on empty lane space
  → parent's onPointerDown runs → dispatch(selectClip(null)) + scrub begins
Store: selectedClipId = null, and seekTo(xToTime(...)) fires
```
Two overlapping click targets, one rule deciding which wins: whoever stops
propagation first.

**Pitfalls hit:**

- Forgetting `stopPropagation` makes every clip click *also* jerk the playhead
  to that spot — the clip appears to "work" but the video jumps.
- `<button>` was chosen over `<div>` deliberately: keyboard focus and Enter come
  free, which M6's inspector will want.
- **Temporary scaffolding:** `SEED_CLIPS` in `timelineSlice.ts` exists only so
  Step 2 has something to draw. **Step 4 deletes it** and restores `clips: []`.

**Deferred:** a track-name gutter on the left (it would shift x=0 away from
`viewportStart` and complicate every coordinate call), and drag/resize (M7).

### Step 3 — Preview overlay
(`types.ts` **rewritten**, `timelineSlice.ts`, `activeClips.ts`,
`components/OverlayCanvas.tsx`, `player/components/VideoPlayer.tsx`)

**New concepts:** a *real* discriminated union; half-open intervals; measuring
one element to position another; two features meeting in one component.

#### The pitfall that forced a type rewrite

Step 1's model *said* discriminated union but wasn't one:

```ts
interface OverlayClip { kind: OverlayKind; props: KeyboardProps | TextProps }
//  ↑ kind and props are two unrelated fields that happen to sit together
if (clip.kind === "keyboard") clip.props.keys   // ❌ error: no `keys` on the union
```

TypeScript narrows a **union of types**, not a field inside one interface.
Checking `kind` told it nothing about `props`. Fixed by moving the union to the
top level:

```ts
interface KeyboardClip extends ClipBase { kind: "keyboard"; props: KeyboardProps }
interface TextClip     extends ClipBase { kind: "text";     props: TextProps }
type OverlayClip = KeyboardClip | TextClip;   // ← the union lives HERE
if (clip.kind === "keyboard") clip.props.keys   // ✅ narrowed
```

The rule: **the discriminant must be a literal type on each member of a union.**
Now `{ kind: "text", props: { keys: [...] } }` is not merely wrong, it is
*unrepresentable* — the compiler refuses to build it.

Knock-on changes:
- `AddClipPayload` → `NewOverlayClip = Omit<KeyboardClip,"id"> | Omit<TextClip,"id">`,
  so the kind↔props pairing survives the trip through the action.
- `addClip` collapsed to `{ id: crypto.randomUUID(), ...action.payload }`.
- `updateClip` can no longer just assign `patch.props` — the compiler now
  demands proof the props match *this* clip's kind. The `in` operator supplies
  it (`"keys" in patch.props`), narrowing both sides at once; a mismatched patch
  is ignored instead of corrupting the clip.

#### Half-open intervals (`activeClips.ts`)

`isClipActive` uses `time >= start && time < start + duration` — **`[start, end)`**.
With clips at 0–2s and 2–4s, `<=` would call both live at exactly 2.000s and
flash two overlays for one frame. With `<`, second 2.000 belongs to exactly one.

`activeClipsAt(tracks, time)` walks tracks in order, so the returned array is
already in draw order (bottom track first) — the same z-order M8 will export.
Both functions are pure and React-free *on purpose*: the renderer must be able
to ask the identical question per frame and get the identical answer.

#### Anchoring the overlay to the video, not the panel

The `<video>` is centred in a black box with `max-h-full max-w-full`, so a 16:9
clip in a wide panel leaves bars at the sides. Anchoring overlays to the panel
would float them over those bars — and M8, which knows only the video frame,
would disagree with what the editor showed. So `OverlayCanvas` measures the
video's own box (`offsetLeft/Top/Width/Height`, relative to the `relative`
parent) and positions itself to match.

**Two** ResizeObservers, because the two things change independently: the video
resizes when metadata loads or the panel gets taller, but it *slides sideways*
when the panel width changes while its own size stays put (it's centred). Only
watching the video would miss the slide.

**Worked example — scrubbing onto a clip:**
```
seed clip: { kind:"keyboard", start:4, duration:2, props:{ keys:["Q","E"] } }

you drag the playhead to 3.9s
  → seekTo(3.9) → element seeks → timeupdate → setTime(3.9)
  → OverlayCanvas re-renders: activeClipsAt(tracks, 3.9)
       3.9 >= 4 ? no  → []  → component returns null, nothing drawn

you drag on to 4.2s
  → activeClipsAt(tracks, 4.2): 4.2 >= 4 ✓ and 4.2 < 6 ✓ → [seed-keys]
  → OverlayItem: clip.kind === "keyboard" → props narrowed to KeyboardProps
  → two keycaps "Q" "E" render at the bottom-centre of the video box

you drag to 6.0s
  → 6.0 < 6 is false → [] → overlay disappears (half-open in action)
```

**Pitfalls hit:**

- The container needed `relative` added. Without a positioned ancestor,
  `offsetLeft` measures from some far-up element and the overlay lands nowhere
  near the video.
- `pointer-events-none` on the canvas, or overlays would eat clicks aimed at
  the video.
- **Known limitation:** `currentTime` is mirrored from the `timeupdate` event,
  which browsers fire only ~4×/second. During playback an overlay can appear or
  vanish up to ~250ms late. Fine for editing (you scrub, and scrubbing is
  exact); M8's export won't have the problem at all because it asks
  `activeClipsAt` per frame. A `requestAnimationFrame` mirror is the M10 fix.

**Deferred:** per-clip x/y position, size, and font (the model has no geometry
yet — overlays stack bottom-centre); mouse/arrow/image kinds.

### Step 4 — Add an overlay at the playhead
(`newClip.ts`, `components/TimelineToolbar.tsx`, `components/Timeline.tsx`,
`timelineSlice.ts`)

**New concepts:** defaults as a pure factory; layout that removes an event
problem instead of patching it; "pass only what the store can't know".

- **`makeNewClip(kind, start, videoDuration)`** — a pure factory returning
  `NewOverlayClip`. Defaults live here, not in the button's onClick, because
  Step 5's duplicate/paste and M7 will want the same answer to "what does a new
  overlay look like?". It also trims `duration` against the remaining video so
  adding at 21:59 of a 22:00 clip doesn't create an overlay hanging past the
  end.
- **`TimelineToolbar` takes exactly one prop: `width`.** Everything else
  (`currentTime`, `duration`, `status`) it reads from the store itself. The
  rule that falls out: *pass down only what the store cannot know* — and the
  measured panel width is the one such number in this component.
- **`SEED_CLIPS` deleted**, `clips: []` restored, as promised in Step 2. The
  empty lane now shows a hint instead of looking broken.

#### Layout as a bug fix

Step 2 put the Fit button *inside* the pointer-handling root, which forced
`onPointerDown={e => e.stopPropagation()}` so clicking it didn't also scrub. Two
more buttons would have meant repeating that hack three times. Instead the
toolbar moved **outside** the root:

```
<div flex-col>                 ← no handlers
  <TimelineToolbar/>           ← buttons live here, can't reach the scrub logic
  <div ref={rootRef} onPointerDown onWheel …>   ← ruler + lanes + playhead
```

`rootRef` now measures this inner box, so `width` still means "the width clips
are drawn in", and the playhead's `inset-y-0` no longer runs up through the
toolbar. **When you find yourself repeating `stopPropagation`, the layout is
usually the thing that's wrong.**

**Worked example — adding a keycap overlay at 4.2s:**
```
Playhead is at currentTime = 4.2 (video duration 1320). You click "+ Keys".

TimelineToolbar.add("keyboard")
  → makeNewClip("keyboard", 4.2, 1320)
      remaining = 1320 − 4.2 = 1315.8
      duration  = max(0.5, min(2, 1315.8)) = 2
      → { kind:"keyboard", name:"Q", start:4.2, duration:2, props:{keys:["Q"]} }
  → dispatch(addClip(thatObject))

timelineSlice.addClip
  → clip = { id: crypto.randomUUID() → "8b1e…", ...payload }
  → tracks[0].clips.push(clip)
  → selectedClipId = "8b1e…"        ← auto-selected, ready for Step 5

re-render, with zoom = 60, viewportStart = 3:
  Timeline  → clipRect(4.2, 2, 3, 60) → x = 72, width = 120
              → ClipBlock at left:72px, with a ring (it is selected)
  Overlay   → activeClipsAt(tracks, 4.2): 4.2 >= 4.2 ✓ and 4.2 < 6.2 ✓
              → a "Q" keycap appears on the video INSTANTLY
```
That last line is the payoff of the half-open interval from Step 3: because the
range is `[start, end)` and `start` *is* the current time, a clip added at the
playhead is live the moment it exists. A closed-on-the-left interval would have
required nudging the playhead before you could see what you just made.

**Pitfalls hit:**

- The new clip's `start` is `currentTime` — **seconds, from the player's clock**.
  It is tempting to derive it from the playhead's pixel position; that would
  make the result depend on zoom and re-introduce rounding. Data comes from
  data.
- `duration` in `TimelineToolbar` means the *video's* length, while
  `clip.duration` means the *overlay's* length. Same word, two meanings — worth
  reading carefully in `makeNewClip`'s signature.

**Deferred:** deleting a clip from the UI (the `deleteClip` reducer exists but
nothing dispatches it yet — Step 5 adds the button), and overlap handling (two
clips at the same second both render, stacked).

### Step 5 — Editing a clip's properties
(`components/ClipInspector.tsx`, `layout/components/PropertiesPanel.tsx`,
`timelineSelectors.ts`, `timelineSlice.ts`, `newClip.ts`)

**New concepts:** derived selectors; controlled inputs; where invariants belong;
the one case where a local draft beats the store.

- **`selectSelectedClip`** — a *derived* selector. The store keeps only an id;
  this walks the tracks and returns the clip it names. No memoisation needed,
  because it returns the object already living in the store — the same
  reference every call until that clip really changes, which is exactly what
  React's re-render check compares.
- **Controlled inputs.** Each field's `value` comes from the store and its
  `onChange` dispatches `updateClip`; the resulting re-render puts the new
  value back in the box. There is no second copy of the truth, so the timeline
  block, the preview overlay and the form can never disagree.
- **Invariants moved into the reducer.** `updateClip` now applies
  `Math.max(0, start)` and `Math.max(MIN_CLIP_DURATION, duration)`. The form
  could have clamped, but then M7's drag and M9's file loader would each have
  to remember to clamp too. **A rule that must always hold belongs where the
  data changes, not where the UI happens to change it.**
- **The panel doesn't own the form.** `PropertiesPanel` only asks "is anything
  selected?" and delegates; `ClipInspector` lives in `features/timeline/`
  beside the data it edits.

#### The one place a local draft is correct

Keys are `string[]` in the data but one comma-separated line in the input. Read
straight from the store, typing `"Q, "` round-trips `["Q"]` → `"Q"` and the
browser eats your comma and space mid-keystroke.

So `KeysField` keeps the raw text in `useState` and dispatches the *parsed*
array. The re-seeding effect depends on **`clip.id` only** — depending on the
keys themselves would overwrite what you are typing on every keystroke.

The general shape: **raw keystrokes are UI state; the parsed value is data.**
Reach for it only when the two genuinely differ — `name` and `text` need no
draft because the string in the box *is* the string in the store.

**Worked example — retiming an overlay:**
```
Selected clip: { id:"8b1e…", start:4.2, duration:2 }, viewport zoom = 60, vs = 3
You select the Length box and type 3.5

onChange("3.5") → patchNumber("duration", "3.5")
  → dispatch(updateClip({ id:"8b1e…", patch:{ duration: 3.5 } }))
  → reducer: findClip → clip.duration = max(0.5, 3.5) = 3.5

one dispatch, three views update from the same fact:
  ClipBlock       clipRect(4.2, 3.5, 3, 60) → width 120 → 210px, block grows
  OverlayCanvas   live window was [4.2, 6.2) → now [4.2, 7.7)
  ClipInspector   the Length box re-renders showing 3.5
```

**Pitfalls hit:**

- `Number("")` is `0`, so clearing a number box would silently retime the clip
  to 0:00. `patchNumber` ignores blank input instead.
- Typing `-` in a number box parses as `NaN`; `Number.isFinite` filters it, and
  the reducer's `Math.max(0, …)` catches genuine negatives.
- `KeysField` is typed `KeyboardClip`, not `OverlayClip` — the parent already
  narrowed via `clip.kind === "keyboard"`, so the child can state the stronger
  type and skip re-checking.

**Deferred:** undo/redo (M10), editing `name` and keys as separate concepts
(right now a new keycap clip is named after its key but they drift once edited),
and per-clip position/size (needs geometry in the model).

### Step 6 — M5 verification pass

**New concepts:** what "verified" means with no test framework; reading your own
code for invariants instead of for bugs.

With no test runner in this project, a milestone is verified by four things:
typecheck, the full production build, a manual click-through, and a live backend
check. Each catches a different class of problem — and none of them catches the
others' class, which is why all four are on the list.

| Gate | Catches |
|------|---------|
| `npm --prefix frontend run build` | type errors, bad imports, export failures |
| `npm run build` (full) | Go compile, Rust release compile, bundler/installer |
| manual checklist | anything about *behaviour* — the only gate that watches |
| `curl /health` | the sidecar still starts and answers |

#### The manual checklist for M5

1. Open a video → the timeline fits the whole thing, ruler labelled sensibly.
2. Park the playhead, click **+ Keys** → a green block appears at that second,
   already ringed (selected), and a `Q` keycap shows on the video immediately.
3. Scrub before the block → keycap disappears. Scrub inside → it returns.
   Scrub to exactly `start + length` → it disappears (half-open interval).
4. Click **+ Text** at a different second → a blue block; edit Text and Colour
   in Properties and watch the video update as you type.
5. Type `Q, E, Shift` into Keys → three keycaps; the commas survive typing.
6. Change **Length** → the block grows/shrinks and the overlay lasts longer.
7. Click a block → it selects and the video does **not** jump. Click empty lane
   space → it deselects and the playhead **does** move.
8. Zoom and pan → blocks stay aligned with the ruler; **Fit** shows everything.
9. **Delete** → the block, the overlay and the form all clear together.
10. Reload → everything is gone. *Expected*: persistence is M9.

#### What re-reading the code turned up

Three things worth writing down, none of them crashes:

- **`clip.start` is never clamped against the video's length.** You can retime
  an overlay to second 5000 of a 1320-second video. It is harmless now (nothing
  renders it, the timeline pan clamp keeps you from even looking at it) but M6
  should fix it, because M8 would happily export a clip nobody can see.
- **Two clips at the same second both render, stacked.** That is arguably
  correct — a keycap *and* a caption at once is a real thing a guide wants —
  but there is no z-order control beyond track order yet.
- **`fittedFor` keys on `sourceUrl`**, and `URL.createObjectURL` mints a fresh
  URL every open. So re-opening the *same file* refits the view. Correct
  behaviour, arrived at by accident rather than design — worth knowing before
  someone "optimises" it to key on the file name.

**The lesson about the gates:** the frontend build passed after every single
step of M5, and it would have passed just as happily if the half-open interval
had been `<=` and every overlay flickered at its boundary. Types check
*structure*; only the checklist checks *meaning*.

## Milestone 6 — Property Inspector

Every overlay in M5 stacked bottom-centre at a fixed size. M6 gives each one its
own geometry: position, size, rotation, opacity, and a fade envelope.

### Step 1 — Geometry in the model

**Files touched:** `frontend/features/timeline/types.ts`,
`frontend/features/timeline/newClip.ts`

**New concepts:** normalized (resolution-independent) coordinates; why geometry
belongs on the base type rather than in `props`; using a *required* field as a
compiler-enforced migration; the shared-mutable-default trap.

Nothing on screen changes in this step. That is the point — the model has to
carry the numbers before Step 2 can read them.

#### The units question, again

M4 asked "seconds or pixels?" and answered *seconds*. M6 asks the same question
in a new costume, and answers *fractions*:

```ts
export interface ClipTransform {
  x: number;        // 0–1 across the frame  (0.5 = halfway)
  y: number;        // 0–1 down the frame    (0.85 = near the bottom)
  scale: number;    // 1 = default size, measured against frame HEIGHT
  rotation: number; // degrees, clockwise, about the overlay's CENTRE
  opacity: number;  // 0 = invisible, 1 = solid
}
```

#### Worked example — one clip, two frame sizes

A text overlay with `transform: { x: 0.5, y: 0.85, … }`. The editor preview is
**800×450**; M8 will export the same project at **1920×1080**.

| | frame | centre lands at | reads as |
|---|---|---|---|
| Preview | 800 × 450 | `0.5 × 800 = 400`, `0.85 × 450 = 382.5` | halfway across, near the bottom |
| Export | 1920 × 1080 | `0.5 × 1920 = 960`, `0.85 × 1080 = 918` | halfway across, near the bottom |

Two very different pixel answers, one identical *meaning*. That is the whole
argument for fractions.

Now suppose we had stored native pixels instead, and the user positioned the
overlay on the preview at `(400, 382)`. Export at 1920×1080 replays those same
numbers, and `400/1920 = 21%` across, `382/1080 = 35%` down — the caption you
carefully centred near the bottom comes out in the upper-left quadrant. The
export would silently disagree with the editor, which is exactly the failure the
`OverlayCanvas` frame-measuring in M5 Step 3 was built to avoid.

The same reasoning picks **height** for `scale`: 1080 ÷ 450 = 2.4, so a
`scale: 1` overlay is 2.4× more pixels tall in the export than in the preview
and occupies the identical share of the picture. Had we scaled off the width, a
21:9 ultrawide recording would shrink every overlay relative to a 16:9 one.

#### Why `transform` sits on `ClipBase`, not in `props`

```ts
interface ClipBase {
  id: string;
  name: string;
  start: number;
  duration: number;
  transform: ClipTransform;   // ← here
}
```

`props` is what makes each kind *different* — keycaps have `keys`, text has
`text` and `color`. Geometry is what every kind has in *common*. Putting it on
the base means the mouse, arrow and image kinds inherit positioning for free
when they arrive, and — more importantly — Step 2's renderer can read
`clip.transform` without first narrowing on `clip.kind`.

#### Required, not optional — letting the compiler do the migration

`transform: ClipTransform` is **required**. Every existing way of building a clip
therefore stops compiling until it supplies one, and the compiler hands you the
list of places to fix. There was exactly one: the two `return` statements in
`makeNewClip`. (`addClip` spreads a `NewOverlayClip` it is handed, so it needed
no change at all.)

Writing `transform?: ClipTransform` instead would have compiled immediately and
felt easier — and then every reader for the rest of the project's life would
have to cope with `undefined`: `clip.transform?.x ?? 0.5` in the renderer, in the
inspector, in the drag handler, in M8's exporter. A one-time fix in one file
beats a permanent tax in five.

#### Pitfall — the shared mutable default

```ts
transform: { ...DEFAULT_TRANSFORM },   // a COPY, not the constant itself
```

Writing `transform: DEFAULT_TRANSFORM` would hand *every* clip a reference to
the same object. Two consequences, both nasty:

- Any code that mutates one clip's transform outside a reducer moves **every**
  overlay at once, because they are all literally the same object.
- Redux Toolkit freezes the state it produces. That constant would become part
  of the store, so it would get frozen — and the exported `DEFAULT_TRANSFORM`
  would silently become immutable everywhere else in the app, including in the
  Reset button planned for Step 4.

Spreading five fields costs nothing. The bug it prevents is the kind you lose an
afternoon to.

#### Pitfall — one patch convention, not two

`ClipPatch` takes a whole `ClipTransform`, matching how `props` already works:
callers spread what they want to keep, `{ ...clip.transform, x: 0.3 }`.
`Partial<ClipTransform>` was the alternative and would let Step 3's drag send
only `x` and `y` — but then `ClipPatch` would contain two different patch
conventions side by side. Consistency with the existing rule won.

**Verified:** `npm --prefix frontend run build` clean — compiled in 6.9s,
TypeScript in 2.1s, all 4 static pages generated. The full `npm run build` gate
could not run on this machine (see the toolchain note below).

**Environment note:** this milestone is being built with `npm run frontend:dev`
only. The machine cannot run `npm run build`, because npm invokes it through
`powershell -File scripts/…`, and a nested PowerShell here is denied permission
to launch *any* executable — `where.exe` and `hostname.exe` fail the same way,
while `cmd.exe` launching the identical binary succeeds. MSVC build tools are
also not installed, so Rust could compile but not link. Neither blocks M6, which
is frontend-only; both must be resolved before M8.

### Step 2 — Render the transform

**Files touched:** `frontend/features/timeline/components/OverlayCanvas.tsx`

**New concepts:** CSS transform *order* and `transform-origin`; percentage
positioning inside a measured box; scaling a whole rendered box vs scaling only
its font; why an element with no width needs `whitespace-nowrap`.

The flex column that stacked every overlay bottom-centre is gone:

```diff
- <div className="pointer-events-none absolute flex flex-col items-center
-                 justify-end gap-2 pb-[6%]" style={frame}>
+ <div className="pointer-events-none absolute" style={frame}>
```

Each item now places itself:

```ts
const style: CSSProperties = {
  left: `${x * 100}%`,
  top: `${y * 100}%`,
  transform: `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale * frameScale})`,
  opacity,
};
```

#### Why percentages and not pixels

The container is *exactly* the measured video frame — that is what `style={frame}`
does. So `left: 50%` already means "half way across the video", and it stays
correct when the frame changes size without recomputing anything. The only place
that still needs the frame in real pixels is `frameScale`, because "how big
should this text be" has no percentage equivalent.

#### Worked example — one label, two frame sizes

A text clip with `transform: { x: 0.5, y: 0.85, scale: 1, rotation: 0,
opacity: 1 }`. Say the rendered label measures **96 × 30** px.

**Frame 800 × 450** (the reference height, so `frameScale = 450/450 = 1`):

1. `left: 50%`, `top: 85%` put the label's **top-left corner** at
   `(0.5 × 800, 0.85 × 450)` = `(400, 382.5)` inside the frame.
2. `translate(-50%, -50%)` shifts it by half its own size — `(−48, −15)`.
3. Its **centre** now sits at `(400, 382.5)`. Exactly the point the data named.

**Frame 1200 × 675** (`frameScale = 675/450 = 1.5`):

1. `left: 50%` → `600`; `top: 85%` → `573.75`.
2. `scale(1.5)` draws the label at **144 × 45** — font, padding and borders all
   1.5× — but scaling happens about its centre, so the centre does not move.
3. Centre still lands on `(600, 573.75)` = halfway across, 85% down. Same
   meaning, bigger picture.

#### Pitfall — transform order is not cosmetic

A CSS transform list applies **right-to-left**, and `transform-origin` defaults
to the element's own centre. That default is what makes this order work: `scale`
and `rotate` both operate about the centre, so neither moves it, and
`translate(-50%, -50%)` is left to do the positioning.

Write it the other way round and it breaks:

| order | what happens to the centre |
|---|---|
| `translate(-50%,-50%) rotate(R) scale(S)` | lands on `(x, y)` — correct |
| `scale(S) rotate(R) translate(-50%,-50%)` | the translate happens first, so the scale multiplies it too |

Concretely: a 100px-wide overlay at `scale: 2`. Correct order shifts it back
50px. Reversed, the scale multiplies that shift to **100px** — every overlay sits
half its own width off-target, and the error grows as you scale up. The
percentages in `translate` resolve against the element's *untransformed* size,
which is precisely why the shift must be applied last.

#### Pitfall — scaling the font is not scaling the overlay

The obvious reading of "derive font size from the frame" is
`fontSize: frame.height * something`. But the keycap's look is Tailwind's
`px-2.5 py-1 border-b-4` — **fixed pixels**. Triple the font and you get large
text crammed into the same small padding with the same hairline 4px bottom
border. It looks wrong immediately.

A CSS `scale` transform scales the entire rendered box — glyphs, padding, border
widths, corner radii — in one uniform step. One number, nothing left behind.

The trade-off worth knowing: the box is laid out at its 1× size and then scaled,
rather than laid out at the final size. Browsers re-rasterize text for a scaled
layer so it stays sharp, and M8's exporter never touches CSS at all — it
recomputes from the same `x, y, scale, rotation` numbers. So the trade-off costs
nothing in either place that matters.

#### Pitfall — an element with no width will wrap

The item is absolutely positioned with no width set, so it shrinks to fit its
content. Put a long caption near the right-hand edge of the frame and the text
wraps into a two-line block — which makes the element **taller**, which moves its
centre, so the overlay no longer sits where the maths says it does.
`whitespace-nowrap` keeps it one line and keeps the geometry honest.

#### Expected consequences of this step

Both are correct, and both get addressed later:

- **Overlays at the same moment now overlap** instead of stacking politely in a
  column. Every clip starts at `DEFAULT_TRANSFORM`, so they land on top of each
  other. Step 3's drag is what pulls them apart — the old flex column was hiding
  the fact that there was no real positioning at all.
- **An overlay can hang outside the frame.** `x: 1.0` puts its centre on the
  right-hand edge, so half of it sits over the black bar. Clamping is Step 6;
  until then it is a useful way to see that the geometry is genuinely live.

**Verified:** `npm --prefix frontend run build` clean — compiled in 937ms,
TypeScript in 2.6s, 4/4 static pages.

### Interlude — the preview panel overflowed into the timeline

**Files touched:** `frontend/components/layout/Panel.tsx` (one class)

**New concepts:** percentage heights need a *definite* parent height; block
containers do not stretch their children vertically; how to test a layout
hypothesis by measuring instead of squinting.

**Reported symptom:** "if video length is long it cuts into the timeline panel."

Duration turned out to be a **red herring** — and that is the useful part of this
story. Measuring the live page found the real defect immediately:

| panel | section height | parent height | fills? |
|---|---|---|---|
| Assets | 164px | 476px | no |
| Preview | 162px | 476px | no |
| Properties | 72px | 476px | no |

**Not one panel filled its container.** Every `<section>` was only as tall as its
own content, in a parent more than twice as tall.

#### The chain of failure

`Panel`'s section had `flex min-h-0 flex-col` but no height. It sits inside a
plain `<div>`, and a **block container does not stretch its block-level children
vertically** — that is a flexbox behaviour, not a block one. So the section's
height was `auto`. From there it cascades, because everything downstream is a
percentage and a percentage of `auto` is not a number:

```
section         height: auto            ← the actual bug
  └ body        flex-1  → nothing definite to fill
      └ VideoPlayer   h-full  = 100% of auto → auto
          └ <video>   max-h-full = 100% of auto → behaves as `none`
                      max-w-full = 100% of a DEFINITE width → this one works
```

The last two lines are the whole thing. With the height cap inert and the width
cap live, the video's height was decided by the panel's **width** ÷ its aspect
ratio. A 16:9 video in a 1200px-wide panel wants to be 675px tall regardless of
whether the row it lives in is 675px or 300px — so it spilled over the row and
covered the timeline.

#### Why it looked like a duration problem

Because of what you do when a video is long: you drag the timeline divider **up**
to see more of the timeline. That shrinks the `main` grid row — and the video's
height, being width-driven, does not shrink with it. Long videos didn't cause the
overflow; *making room for their timelines* did. Same bug at any duration, just
easier to trigger.

#### The fix

```diff
- <section className="flex min-h-0 flex-col …">
+ <section className="flex h-full min-h-0 flex-col …">
```

`h-full` gives the section a definite height, which gives the body one, which
makes `h-full` and `max-h-full` downstream mean something, which lets
`object-contain` letterbox the video inside the space available instead of
overflowing it.

**Verified by measurement, not by eye** — after the change, all three panels
report `fills: true` at 476px, and the four grid rows are exactly contiguous:
menubar 0→36, main 36→512, timeline 512→692, statusbar 692→720. No overlap.
`npm --prefix frontend run build` clean.

#### The lessons

- **A percentage needs something definite to be a percentage OF.** `h-full`,
  `max-h-full`, `flex-1` and `min-h-0` are all in this family. One `auto` high up
  silently disables every one of them below it.
- **Reproduce by measuring.** The reported cause (duration) and the real cause
  (a missing class three components away) had nothing to do with each other. Four
  numbers from `getBoundingClientRect()` settled in seconds what could have been
  an hour of changing classes and reloading.
- **`min-h-0` without a height is half a fix.** The codebase already had
  `min-h-0` in all the right places — that stops flex children refusing to
  shrink, but it cannot invent a height for a box that was never given one.

### Step 3 — Drag to position

**Files touched:** `frontend/features/timeline/overlayCoords.ts` (new),
`frontend/features/timeline/timelineSlice.ts`,
`frontend/features/timeline/components/OverlayCanvas.tsx`

**New concepts:** delta-based dragging (and why absolute would feel wrong);
selectively lifting `pointer-events`; a reducer branch that did not exist yet.

#### The mirror of `xToTime`

M4 converted a pixel into a second by dividing by `zoom` (pixels per second).
M6 converts a pixel into a fraction by dividing by the frame's size in pixels.
Same move, different unit:

```ts
export function draggedPosition(start, delta, frame) {
  if (frame.width <= 0 || frame.height <= 0) return start;   // pre-metadata guard
  return {
    x: start.x + delta.dx / frame.width,
    y: start.y + delta.dy / frame.height,
  };
}
```

Pure and React-free, like every other coordinate helper, so M7's snapping and
M8's exporter can call it and get the same answer the editor gave.

#### Worked example — one drag, click by click

Frame is **800 × 450**. A text overlay sits at `x: 0.5, y: 0.85`. You grab it
**20px right of its centre** and drag up and to the left.

**1. `pointerdown`** at `clientX: 520, clientY: 400`.

```ts
dragStart.current = { pointerX: 520, pointerY: 400, x: 0.5, y: 0.85 };
event.currentTarget.setPointerCapture(event.pointerId);
dispatch(selectClip(clip.id));        // Properties panel follows your hand
```

**2. `pointermove`** to `clientX: 360, clientY: 310`:

```
dx = 360 − 520 = −160        dy = 310 − 400 = −90
x  = 0.5  + (−160 / 800) = 0.5  − 0.2 = 0.30
y  = 0.85 + (−90  / 450) = 0.85 − 0.2 = 0.65
```

**3. Dispatch** `updateClip({ id, patch: { transform: { …clip.transform, x: 0.30, y: 0.65 } } })`.

**4. The reducer** clamps `x`/`y` to 0–1 — both already inside — and stores them.

**5. Re-render**: `left: 30%`, `top: 65%`, so the overlay's centre is now 240px
across and 292.5px down the frame. And because it is still centre-anchored, it
moved by exactly the 160 × 90 pixels your hand did.

#### Why deltas and not the pointer's absolute position

The tempting version is "put the overlay wherever the cursor is". But you grabbed
this one 20px right of its centre — so on the very first `pointermove` the centre
would **jump 20px left** to sit under your cursor. Grab a wide caption near its
edge and it leaps across the screen before you have moved a pixel.

Working in deltas means the overlay follows your hand instead of snapping to it.
As a bonus, we never need to know *where the frame sits in the window* — only how
big it is, which the two ResizeObservers already track.

#### Pitfall — don't read the live position mid-drag

Every `pointermove` dispatches, and every dispatch re-renders this component. So
mid-gesture, `clip.transform.x` is *already* the value the previous move wrote.
Combine it with the total delta —

```ts
x: clip.transform.x + (event.clientX - dragStart.current.pointerX) / frame.width  // WRONG
```

— and the same movement gets added again on every single move: the overlay
accelerates away from the cursor. Recording the position at the *start* and
adding the total movement since is what keeps it honest. `PanelDivider` does the
identical thing with `dragStart.size`, for the identical reason.

#### Pitfall — the reducer had no branch for `transform`

Step 1 added `transform?: ClipTransform` to `ClipPatch`, and Step 2 rendered
`clip.transform`. But `updateClip` never *read* `patch.transform` — so the first
drag dispatched a perfectly valid action that changed nothing at all.

Nothing catches this. The types are satisfied on both sides: the patch is legal
to construct and legal to hand to the reducer. Only a reader who checks that the
reducer actually consumes the field will notice. **A type system verifies the
shape of what you pass, never that anyone read it.**

#### Pitfall — lift `pointer-events` selectively, never wholesale

The container is `pointer-events-none` so the video keeps receiving clicks. To
make an overlay draggable it needs events back — but only the overlay:

```
container   pointer-events-none     ← the whole frame stays click-through
  └ item    pointer-events-auto     ← except exactly where an overlay is
```

Deleting `pointer-events-none` from the container instead would turn the entire
video frame into one invisible click-blocker, breaking every future click-on-the-
video interaction for the sake of a few small draggable boxes.

Two smaller companions on the item: `touch-none`, so a touch drag isn't stolen by
the browser to scroll the page, and `select-none`, so the caption doesn't
highlight as you drag it. Plus `event.preventDefault()` in `pointerdown` — without
it the browser starts its own text-selection drag and the overlay stutters as the
two gestures fight.

#### Where the clamp went, and why

`draggedPosition` deliberately does **not** clamp. "An overlay never leaves the
frame" is a rule about the data, so it lives in the reducer:

```ts
if (patch.transform !== undefined) {
  clip.transform = {
    ...patch.transform,
    x: clamp(patch.transform.x, 0, 1),
    y: clamp(patch.transform.y, 0, 1),
  };
}
```

Step 4's number fields and M9's project loader then inherit it for free, exactly
as they inherit `start >= 0` and `duration >= MIN_CLIP_DURATION`. Drag far past
the left edge and `x` computes to `−0.125`, the reducer stores `0`, and the
overlay parks with half of itself over the letterbox bar — centre-anchored, as
designed. Note the small consequence: having pinned at the edge, you must drag
back *past* that point before it moves again. `PanelDivider` behaves the same way
at `MIN_SIZE`.

`scale`, `rotation` and `opacity` are left unclamped until Step 6, because
nothing but `DEFAULT_TRANSFORM` writes them yet.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages. The page
loads with no application errors — the seven console errors are all
`GET 127.0.0.1:3939/health` refusals, which is the expected shape of running
frontend-only with no Go sidecar. **The drag gesture itself was not machine-
verified**: it needs a loaded video, and a file `<input>` cannot be driven from
outside the browser. See the manual checks in the chat notes for this step.

### Step 4 — Inspector controls

**Files touched:** `frontend/features/timeline/components/Field.tsx` (new),
`frontend/features/timeline/components/TransformFields.tsx` (new),
`frontend/features/timeline/components/ClipInspector.tsx`,
`frontend/features/timeline/overlayCoords.ts`,
`frontend/features/timeline/timelineSlice.ts`

**New concepts:** extract-on-second-use, done for real; two controls editing one
value with neither being authoritative; `Partial<T>` as a single-field patch;
rounding where imprecision *enters* rather than where it is displayed.

#### The extraction

`Field` and the `INPUT` class string were private helpers inside ClipInspector.
Step 4 gave them a second consumer, so they moved to `Field.tsx`. That is the
rule working as intended — extracting on the *first* use is guessing at a shape
you have only seen once; waiting past the second means two copies drifting apart.

The five new rows went into their own `TransformFields.tsx` rather than into
ClipInspector, for two reasons: ClipInspector was already ~180 lines and would
have blown past the ~300-line guideline, and "fields that edit timing and
content" versus "fields that edit geometry" are genuinely two jobs. Result:

| file | lines |
|---|---|
| ClipInspector.tsx | 175 |
| TransformFields.tsx | 163 |
| Field.tsx | 31 |

#### Two controls, one value

Each row is a range slider and a number box bound to the **same** `value`,
calling the **same** `onChange`:

```tsx
<input type="range"  value={value} onChange={(e) => onChange(Number(e.target.value))} />
<input type="number" value={value} onChange={(e) => commit(e.target.value)} />
```

There is no question of which control is authoritative, because neither is — the
store is. Drag the slider and the box follows; type in the box and the slider
follows. Give either one its own `useState` and they immediately drift apart.

#### Worked example — the Opacity row

Store holds `opacity: 1`.

**Drag the slider to 0.4.** The range fires `change` with `"0.4"` →
`onChange(0.4)` → `set({ opacity: 0.4 })` → the patch spreads to
`{ x: 0.5, y: 0.85, scale: 1, rotation: 0, opacity: 0.4 }` → reducer stores it →
re-render puts the slider at 0.4, the box at `0.4`, and the overlay at 40%
opacity on the video. One dispatch, three views agreeing.

**Now type in the box.** Select-all, type `0`:

| keystroke | `event.target.value` | dispatched? | box shows |
|---|---|---|---|
| `0` | `"0"` | yes → 0 | `0` |
| `.` | `""` | **no** | `0.` |
| `7` | `"0.7"` | yes → 0.7 | `0.7` |

The middle row is the interesting one. `"0."` is not a valid number, so the
browser reports the value as empty; the blank guard skips the dispatch; nothing
re-renders; and the DOM keeps your literal `0.` on screen until you type the
digit that makes it real.

That is the KeysField lesson — *keep the user's keystrokes until they parse* —
achieved **without a draft**, because here the store and the input hold the same
*shape* of value (a number). KeysField needed a draft only because `string[]` and
`"Q, E"` are genuinely different shapes.

#### Pitfall — round where imprecision enters, never where it is shown

Dragging divides pixels by pixels, so `x` lands on values like
`0.30124999999999996`, and a number box showing that is unusable.

The tempting fix is to round in the input: `value={Number(value.toFixed(2))}`.
**Don't.** That is a controlled input displaying something different from the
store, which is exactly the KeysField bug in a new costume: type `0.375`, the
store takes 0.375, the display rounds to `0.38`, and your third decimal is eaten
as you type it.

So the rounding goes where the imprecision is created and stored — one choke
point in the reducer, alongside the clamp:

```ts
x: roundPosition(clamp(patch.transform.x, 0, 1)),
y: roundPosition(clamp(patch.transform.y, 0, 1)),
```

Four decimals is ~0.2px at a 1920-wide export — finer than anyone can see. Drag
freehand and the box now reads `0.3012`.

#### Pitfall — `Partial<T>` keeps the spread in one place

`ClipPatch.transform` carries a *whole* `ClipTransform`, so a single-field edit
has to spread the current one. Doing that at five call sites would be five
chances to forget a field:

```ts
function set(changes: Partial<ClipTransform>) {
  dispatch(updateClip({ id: clip.id, patch: { transform: { ...transform, ...changes } } }));
}
// then: set({ x }), set({ scale }), set({ rotation }) …
```

TypeScript still checks every field name and type at the call site, and the
spread exists exactly once.

#### The Reset button, and the copy again

```tsx
onClick={() => set({ ...DEFAULT_TRANSFORM })}
```

Spread, not the constant itself — for the same reason `makeNewClip` spreads it.
Handing the module constant into the store lets Redux Toolkit freeze it, and
every later Reset would be resetting a frozen object.

#### Units: shown in the data's own units

`X` and `Y` read 0–1 rather than 0–100%. A percentage display would be friendlier
to a newcomer, but it means a conversion in both directions and two sets of units
in the codebase — and disagreeing units between editor and exporter is the exact
failure M6 Step 1 chose fractions to avoid. One set of units everywhere.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages. Page
loads with no application errors (only the expected `127.0.0.1:3939/health`
refusals). **The controls themselves were not machine-verified** — reaching them
needs a selected clip, which needs a loaded video.

**Watch item:** `OverlayCanvas.tsx` is now 247 lines and Step 5 adds the fade
envelope to it. If it crosses ~300, the drag handlers are the natural thing to
lift into a hook.

### Step 5 — Fade in / fade out

**Files touched:** `frontend/features/timeline/clipOpacity.ts` (new),
`frontend/features/timeline/types.ts`, `frontend/features/timeline/newClip.ts`,
`frontend/features/timeline/timelineSlice.ts`,
`frontend/features/timeline/components/OverlayCanvas.tsx`,
`frontend/features/timeline/components/ClipInspector.tsx`

**New concepts:** linear interpolation from first principles; multiplying an
envelope instead of replacing a value; choosing an operator so the awkward case
handles itself.

#### Fades are timing, not geometry

`fadeIn` and `fadeOut` went on `ClipBase` beside `start` and `duration` — **not**
inside `transform`. `transform` answers "where does this sit"; fades answer "how
does it behave over its lifetime". Two different questions, and M8 will consume
them at different stages of the pipeline.

#### Interpolation, from nothing

A fade is one division. "How far through the ramp am I, as a fraction?"

```ts
if (clip.fadeIn > 0 && elapsed < clip.fadeIn) {
  envelope = elapsed / clip.fadeIn;      // 0.2s into a 0.5s fade → 0.4 → draw at 40%
}
```

No curve, no easing, no state. Same clip and same time in, same number out,
forever — which is exactly what lets the editor call it on every render and M8
call it on every exported frame and be certain they agree.

#### Multiply, never replace

```ts
return clip.transform.opacity * envelope;
```

An overlay you set to 50% opacity that also fades in reaches **50%**, not 100%.
The envelope scales what you asked for rather than overriding it. Replacing would
silently discard a value the user deliberately set.

#### Worked example — a 2s clip at t=10 with 0.5s fades

Verified numerically:

| time | 10.0 | 10.25 | 10.5 | 11.0 | 11.5 | 11.75 | 11.999 | 12.0 |
|---|---|---|---|---|---|---|---|---|
| opacity | 0.000 | 0.500 | 1.000 | 1.000 | 1.000 | 0.500 | 0.002 | 0.000 |

Note `t=10.0` is **0**, not 1. At the clip's very first instant `elapsed` is 0, so
`0 / 0.5` is 0. That is arithmetically right and visually right — a fade-in that
started at full brightness would not be a fade. And `t=12.0` is 0 because the
half-open interval `[start, end)` has already ended.

#### The nicest line in the step

```ts
envelope = Math.min(envelope, remaining / clip.fadeOut);
```

`Math.min`, not assignment — and that single choice makes the degenerate case
handle itself. Give a **2s** clip a **1.5s fade-in and a 1.5s fade-out** and the
ramps overlap in the middle. Taking the smaller means whichever ramp is more
restrictive right now wins:

| time | 10.0 | 10.5 | 11.0 | 11.5 | 12.0 |
|---|---|---|---|---|---|
| opacity | 0.000 | 0.333 | **0.667** | 0.333 | 0.000 |

The overlay simply peaks at 67% instead of reaching full. No value above 1, no
flicker between two ramps, no validation error to show the user, no special case
in the code. **Picking the right operator beat writing a guard clause.**

### Step 6 — Guard rails + verification

**Files touched:** `frontend/features/timeline/timelineSlice.ts`,
`frontend/features/timeline/newClip.ts`, `docs/Learning.md`, `docs/Roadmap.md`,
`CLAUDE.md`

**New concepts:** an exhaustive object literal as compile-time coverage; refusing
NaN at the door; an invariant spanning two fields; a payload field only some
callers need.

#### Every geometry field now has a rule

| field | rule | why |
|---|---|---|
| `x`, `y` | clamp 0–1, round to 4dp | never leaves the frame; readable numbers |
| `scale` | clamp `MIN_SCALE`–`MAX_SCALE` (0.05–20) | never invisible, never swallows the frame |
| `rotation` | fold into one turn | 3600° is nonsense to read and re-derive |
| `opacity` | clamp 0–1 | outside that range is meaningless to CSS and to ffmpeg |

The limits are deliberately **wider than the sliders**: Step 4 offers 0.2–4 to
drag through, the data accepts 0.05–20. The slider is a comfortable range; the
clamp is the boundary of the sensible. Keeping them apart means a deliberately
typed 6× is not rejected for no reason.

#### Compile-time coverage, for free

The transform block builds its object **field by field** rather than spreading
`patch.transform`:

```ts
clip.transform = {
  x: roundPosition(clamp(finiteOr(next.x, DEFAULT_TRANSFORM.x), 0, 1)),
  y: …, scale: …, rotation: …, opacity: …,
};
```

If `ClipTransform` ever gains a sixth field, this literal **stops compiling**
until that field is given a rule here. A spread would have silently let it
through unguarded. The same trick as the discriminated union in M5: arrange the
types so the compiler asks the question you would otherwise have to remember.

#### Refusing NaN at the door

```ts
function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}
```

A NaN in geometry is uniquely nasty: it renders as `transform: scale(NaN)`, the
overlay silently disappears, and **nothing anywhere reports an error**. Not a
crash, not a console warning — just a missing overlay and a confused user. One
guard at the single point where geometry is written closes it for every caller,
including M9's file loader.

#### The rotation wrap, and JavaScript's `%`

```ts
return ((((degrees + 180) % 360) + 360) % 360) - 180;
```

That double-modulo dance exists because JavaScript's `%` keeps the **sign of the
left operand**: `-90 % 360` is `-90`, not `270`. Verified:

| in | 370 | 730 | 359 | −90 | −270 | −370 |
|---|---|---|---|---|---|---|
| out | 10 | 10 | −1 | −90 | 90 | −10 |

#### An invariant that spans two fields

Shortening a clip must not leave a fade longer than the clip:

```ts
clip.duration = clamp(…);
clip.fadeIn  = Math.min(clip.fadeIn,  clip.duration);
clip.fadeOut = Math.min(clip.fadeOut, clip.duration);
```

Set a 4s clip to fade in over 3s, then drag its Length down to 1s. Without those
two lines you have a 1s clip carrying a 3s fade — a state no form validated,
because no single field was invalid. **The invalid thing was the combination**,
which is precisely why it has to live where the data changes.

#### The M5 leftover, finally fixed

M5's verification pass noted: *"`clip.start` is never clamped against the video's
length. You can retime an overlay to second 5000 of a 1320-second video."* Now:

```ts
const latestStart =
  videoEnd === null ? Infinity : Math.max(0, videoEnd - MIN_CLIP_DURATION);
clip.start = clamp(finiteOr(patch.start, clip.start), 0, latestStart);
```

The interesting part is *how the reducer learned the video's length*. `duration`
lives in the **player** slice; this is the **timeline** slice. So it arrives in the
payload, exactly as the viewport actions carry `bounds`:

```ts
action: PayloadAction<{ id: string; patch: ClipPatch; videoDuration?: number }>
```

It is **optional** on purpose, and that deserves justification rather than being
waved through. Only a patch touching `start` or `duration` can violate this rule;
the drag and the geometry sliders cannot. Making it required would force every
transform-only caller to reach into another slice for a number it has no use for.
The trade-off: a future caller editing `start` could forget to pass it. That risk
is accepted because the field is visible in the action's type, which is where the
next person will look.

Note also the guard on the value itself:

```ts
videoDuration > 0 ? videoDuration : null
```

Before metadata loads, `duration` is `0`. Clamping against 0 would collapse every
clip to the very start of the video — a bug that only appears in the moment
between opening a file and its metadata arriving, and would have been miserable to
reproduce.

#### The M6 manual checklist

Types and builds cannot see any of this. Only clicking can.

1. Open a video, add **+ Text** → it appears bottom-centre, as in M5.
2. Add **+ Keys** at the same second → the two overlap. *Expected*: both start at
   the same default position.
3. Drag them apart. Cursor reads `grab`, then `grabbing`.
4. Grab an overlay **near its edge** → it follows your hand with no initial jump.
5. Drag hard past the left edge → it stops with half of itself over the black bar
   (centre-anchored). Drag back — expect a short dead zone first.
6. Click the video **away from any overlay** → behaves as before. The selective
   `pointer-events` lift is intact.
7. Drag an unselected overlay → it selects on grab; Properties follows.
8. **Rotation** 45 then −45 → spins about its own centre, not a corner.
9. **Scale** 4 then 0.2, then resize the preview panel → scale and frame size
   compound rather than fight.
10. **Reset** → all five snap back. Press it **twice**; the second must also work
    (the frozen-constant trap).
11. Type `0.35` into a number box → the decimal point survives the keystroke.
12. **Fade in** 0.5 on a 2s clip → scrub slowly across its start; it ramps up
    rather than popping. At the exact first frame it is invisible.
13. Fade in **1.5** and fade out **1.5** on a **2s** clip → it peaks part-way, no
    flicker at the crossover.
14. Set fade in 3 on a 4s clip, then set Length to 1 → the fade follows down to 1.
15. Set **Start** beyond the end of the video → it stops at
    `videoLength − 0.5`, not past the end.
16. Reload → everything is gone. *Expected*: persistence is M9.

#### Verification status — read this honestly

| gate | result |
|---|---|
| `npm --prefix frontend run build` | ✅ clean, 4/4 static pages, TypeScript 1.2s |
| Page loads without app errors | ✅ only `127.0.0.1:3939/health` refusals (no sidecar) |
| Fade + rotation arithmetic | ✅ verified numerically against the tables above |
| `npm run build` (full gate) | ⛔ **cannot run on this machine** |
| Manual checklist (16 items) | ⛔ **not yet run** |

The full gate is blocked by the environment, not by the code: npm invokes it
through `powershell -File scripts/…`, and a nested PowerShell here is denied
permission to launch any executable — `where.exe` fails identically, while
`cmd.exe` launching the same binary succeeds. MSVC build tools are also absent, so
Rust could compile but not link. **M6 is therefore frontend-verified, not
fully-gated**, and should not be recorded as green until both are resolved.

## Milestone 7 — Timeline Editing

M6 gave overlays geometry on the video. M7 makes the *timeline* editable: move,
resize, snap, multi-select, duplicate.

### Step 1 — Move a clip along its lane

**Files touched:** `frontend/features/timeline/components/ClipBlock.tsx`,
`frontend/features/timeline/components/Timeline.tsx`

**New concepts:** the click-vs-drag threshold; why a *delta* conversion has no
`viewportStart` term; splitting a gesture from the maths it feeds.

#### Who owns what

`ClipBlock`'s header comment has said since M5 that it is deliberately dumb — no
time↔pixel math, nothing from the store. M7 keeps that, and the split turns out
to fall naturally:

| concern | lives in | why |
|---|---|---|
| pointer capture, threshold, "where did this clip start?" | `ClipBlock` | it owns the element the gesture happens on |
| pixels → seconds, dispatching | `Timeline` | it owns `zoom`, and it already owns every other conversion |

So `ClipBlock` reports `onMoveBy(id, startAtDragBegin, deltaPx)` — three facts it
already knows — and stays ignorant of zoom.

#### Worked example — dragging a clip two seconds later

`zoom = 40` px/s, `viewportStart = 0`. A clip at `start: 5.0, duration: 2.0`, so
its block is drawn at `x = 200`, `width = 80`.

**1. `pointerdown`** at `clientX: 520`:

```ts
onSelect(clip.id);                                    // select immediately
gesture.current = { pointerX: 520, start: 5.0 };      // capture the origin ONCE
event.currentTarget.setPointerCapture(event.pointerId);
```

**2. Pointer twitches to 522.** `deltaPx = 2`, below the 3px threshold → **nothing
happens at all**. No dispatch, no store write. Still a click.

**3. Pointer reaches 560.** `deltaPx = 40`, past the threshold:

```
onMoveBy(id, 5.0, 40)
  → start = 5.0 + 40 / 40 = 6.0
  → dispatch(updateClip({ id, patch: { start: 6.0 }, videoDuration }))
```

**4. Re-render.** `clipRect(6.0, 2.0, 0, 40)` → `x = 240`. The block is 40px right
of where it was, and the pointer moved 40px. They match exactly, which is the
whole test of whether the conversion is right.

Nothing "moved" the block. Its position is recomputed from `clip.start` every
render, exactly as it has been since M5 — the drag only changes the number.

**Zoom independence for free.** Zoom to 400 px/s and the same 40px gesture is
`40/400 = 0.1s`. One gesture, ten times finer control, because the divisor *is*
the zoom.

#### Why there is no `viewportStart` in the delta

`xToTime` needs `viewportStart` because it maps an absolute pixel to an absolute
second. A delta is a *difference*, and the term cancels:

```
xToTime(x₂) − xToTime(x₁)
  = (viewportStart + x₂/zoom) − (viewportStart + x₁/zoom)
  = (x₂ − x₁) / zoom
```

That is not a shortcut, it is the reason the drag is robust: if the viewport pans
mid-gesture, the clip cannot jump, because `viewportStart` was never in the sum.

#### Pitfall — a click and a drag start with the identical event

One `pointerdown` on a block has three plausible meanings: select it, drag it, or
(if it reached the lane beneath) scrub the playhead. Three defences, each doing one
job:

- `event.stopPropagation()` — already there since M5, so the timeline root's
  scrub handler never sees it. This is the *legitimate* kind of
  `stopPropagation`: one element, one reason, documented. Not the smell the M4
  toolbar had, where every button needed one.
- `onSelect` fires on `pointerdown`, so selection is instant either way.
- The 3px threshold decides drag-or-click. Without it, hand tremor retimes the
  clip by `1/zoom` seconds — 0.025s at 40 px/s — on every single selection click,
  and each one is a real store write.

#### Pitfall — capture the origin, never read it live

`gesture.current.start` is recorded on `pointerdown` and never re-read. Every move
dispatches, every dispatch re-renders, so `clip.start` mid-drag is *already* the
value the last move wrote. Combining that with the total delta makes the clip
accelerate away from the cursor. Third time this trap has appeared —
`PanelDivider`, M6's overlay drag, now here — and the fix is identical each time.

#### The `videoDuration` note, redeemed

M6 Step 6 made `videoDuration` optional in `updateClip`'s payload and left a note
that M7's drag must pass it. This is that caller:

```ts
dispatch(updateClip({ id, patch: { start: … }, videoDuration: duration }));
```

Drag a clip hard to the right in a 96.4s video and the reducer stops it at
`96.4 − 0.5 = 95.9`. Drag hard left and it stops at `0`. **No clamping logic
exists in the drag handler** — it inherited all of it.

#### Known limitation — no auto-pan at the edges

Drag a clip past the left edge of a scrolled viewport and, once the block is
*entirely* off-screen, `isRectVisible` culls it, the component unmounts, pointer
capture dies with it, and the drag ends. It takes deliberate effort (the clip also
clamps at 0), and `MIN_CLIP_WIDTH = 4` means a block is never a hairline. The real
fix is auto-panning while dragging near an edge, which is a feature in its own
right — noted here, not smuggled into this step.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages. Page loads
with no application errors (only the expected `127.0.0.1:3939/health` refusals).
**The drag itself is not machine-verified** — clip blocks only exist once a video
is loaded, and a file `<input>` cannot be driven from outside the browser.

### Step 2 — Resize by dragging the edges

**Files touched:** `frontend/features/timeline/components/ClipBlock.tsx`,
`frontend/features/timeline/components/Timeline.tsx`

**New concepts:** deciding a gesture from coordinates instead of from separate
handle elements; a rule about the GESTURE versus a rule about the DATA.

#### One handler, three zones

Step 1 had one gesture; now there are three. The obvious implementation is a
handle element at each end with its own `pointerdown` — and it is the wrong one,
because each handle would then need `stopPropagation` to stop the block's own move
gesture firing as well. "Every child needs a `stopPropagation`" is precisely the
smell that moved the toolbar out of the pointer root back in M4.

So the block keeps its single handler and works out *which* gesture from the
pointer's position within its own rect:

```ts
const rect = event.currentTarget.getBoundingClientRect();
const offsetX = event.clientX - rect.left;
const kind: ClipGesture = !showHandles
  ? "move"
  : offsetX <= HANDLE_PX          ? "resize-left"
  : offsetX >= rect.width - HANDLE_PX ? "resize-right"
  : "move";
```

The two handle `<span>`s that appear on hover have **no handlers at all**. They
exist to supply a `cursor-ew-resize` and a visual hint; their pointer events
bubble straight up to the button, which does the coordinate maths anyway. (They
are spans, not divs, because a `<button>`'s content model is phrasing content.)

**And a narrow-block guard.** At full zoom-out a clip is drawn at
`MIN_CLIP_WIDTH = 4`px. Carve 6px off each end of that and there is no middle
left — the clip becomes nothing but handles and could never be moved again. So
below `HANDLE_PX * 3` the whole block means "move" and the handles are not drawn.

#### The left edge, and the trap in it

The right edge is easy: only `duration` changes, and the reducer's existing floor
and ceiling apply untouched. The left edge must change **`start` and `duration`
together so the clip's END stays put** — and getting there naively produces a real
bug. Verified numerically, on a clip at `start: 2, duration: 3` (so it ends at 5),
dragged 4 seconds left:

| approach | result | |
|---|---|---|
| naive — send `start: −2, duration: 7`, let the reducer clamp | `start 0, duration 7, end 7` | ❌ the end **moved** |
| guarded — clamp start first, derive duration from it | `start 0, duration 5, end 5` | ✅ |

In the naive version the reducer dutifully pins `start` to 0 — that is its job —
but it has no reason to touch the length it was handed, so the end slides from 5
to 7 and the clip grows out from under your cursor.

```ts
const end = origin.start + origin.duration;
const nextStart = clamp(origin.start + deltaSeconds, 0, end - MIN_CLIP_DURATION);
dispatch(updateClip({ id, patch: { start: nextStart, duration: end - nextStart }, videoDuration: duration }));
```

#### The distinction worth keeping

That clamp lives in the **caller**, which looks at first glance like it violates
the rule we have been applying since M5 — invariants belong in the reducer. It
does not, and the difference is the useful idea:

- **"`start` >= 0" is a rule about the DATA.** Every writer must obey it, so it
  lives in the reducer and everybody inherits it.
- **"this gesture keeps the end fixed" is a rule about the GESTURE.** The reducer
  only ever sees two numbers; it cannot know which of them you meant to hold
  still. `resize-right` deliberately lets the end move. Pushing this into the
  reducer would mean teaching it about pointer intent.

The test: could another caller reasonably want the opposite? For "start ≥ 0", no.
For "hold the end still", yes — that is `resize-right`.

#### Verified numerically

`MIN_CLIP_DURATION = 0.5`, clip at `start: 2, duration: 3`, end 5:

| gesture | result |
|---|---|
| left edge, 1s left | `start 1, duration 4, end 5` |
| left edge, 2.8s right | `start 4.5, duration 0.5, end 5` (hits the floor) |
| left edge, 10s right | `start 4.5, duration 0.5, end 5` (cannot invert) |
| right edge, 2s right | `start 2, duration 5, end 7` (start untouched) |
| right edge, 10s left | `start 2, duration 0.5, end 2.5` (hits the floor) |

Dragging the left edge far past the right one cannot flip the clip inside out; it
simply parks at the minimum length with its end still nailed to second 5.

#### Free inheritance, again

Trimming a clip shorter than its fade needs no code here at all: M6 Step 6 put
`clip.fadeIn = Math.min(clip.fadeIn, clip.duration)` in the reducer, so a 4s clip
with a 3s fade-in trimmed down to 1s brings its fade down with it. That invariant
was written for the Length number box and a drag it knew nothing about inherited
it.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages; page loads
with no application errors; the resize arithmetic verified numerically against the
table above, including the naive-vs-guarded comparison. **The gestures themselves
are not machine-verified** — blocks need a loaded video.

### Step 3 — Snapping

**Files touched:** `frontend/features/timeline/snapping.ts` (new),
`frontend/features/timeline/components/ClipBlock.tsx`,
`frontend/features/timeline/components/Timeline.tsx`

**New concepts:** a tolerance defined in pixels but compared in seconds; choosing
between two candidate corrections; a ref and a piece of state side by side for
opposite reasons.

#### The one line the whole step rests on

```ts
const tolerance = bypassSnap ? 0 : SNAP_PX / zoom;
```

`SNAP_PX` is **8 pixels**. Dividing by zoom turns it into seconds, and that is
what makes snapping feel constant under your hand at any zoom:

| zoom | tolerance |
|---|---|
| 10 px/s (zoomed out) | 0.800s |
| 40 px/s | 0.200s |
| 120 px/s | 0.067s |
| 400 px/s (zoomed in) | 0.020s |

Define the tolerance in *seconds* instead and it inverts: immovably sticky when
zoomed out, useless when zoomed in. **Pixels are how the gesture feels; seconds
are what the data means; the conversion belongs at the boundary between them** —
the same principle as `deltaPx / zoom` in Step 1, applied to a threshold instead
of a movement.

Alt sends a tolerance of `0`, and `snapTime` bails immediately on `<= 0`. That is
why the bypass needs no branch anywhere else in the code.

#### A move snaps whichever edge is closer

Snapping only the clip's start would be half a feature — you could line a clip's
beginning up with things but never butt its **end** against the next clip. So
`snapMovedClip` tries both edges and keeps the **smaller correction**, so the clip
jumps as little as possible:

```ts
const startCorrection = byStart.guide === null ? Infinity : Math.abs(…);
const endCorrection   = byEnd.guide   === null ? Infinity : Math.abs(…);
if (startCorrection <= endCorrection) return byStart;
return { time: byEnd.time - duration, guide: byEnd.guide };   // derive start from the end
```

`Infinity` for "this edge found nothing" is doing real work: without it there are
three combinations to handle (start only, end only, both), and with it there is
one comparison. Same trick as `Math.min` in M6's fade envelope — pick the
representation so the awkward cases stop being special.

#### Worked example — verified numerically

Another clip occupies **10 → 13**. The playhead is at **5**. Video is 96.4s. So
the targets are `[0, 5, 96.4, 10, 13]`. The dragged clip is **2s** long, zoom 40
(tolerance 0.2s):

| candidate start | result | what happened |
|---|---|---|
| 9.90 | start **10.0**, end 12.0, guide 10 | start was 0.1 from 10 |
| 8.05 | start **8.0**, end **10.0**, guide 10 | the END snapped — clip butts against the neighbour |
| 4.92 | start **5.0**, end 7.0, guide 5 | snapped to the playhead |
| 9.00 | start 9.0, end 11.0, guide **null** | nothing within 0.2s |
| 10.85 | start **11.0**, end **13.0**, guide 13 | end snapped to the neighbour's end |
| 9.90 with Alt | start 9.9, guide null | bypassed |

The duration is exactly 2 in every row. **A move never resizes**, whichever edge
did the snapping.

Ties resolve to the start (`<=`, not `<`), so the same drag always gives the same
answer rather than depending on the order of the targets array.

#### Order matters: snap proposes, clamp decides

In `resize-left` the snap runs *before* the clamp:

```ts
const snapped = snapTime(origin.start + deltaSeconds, targets, tolerance);
const nextStart = clamp(snapped.time, 0, end - MIN_CLIP_DURATION);
```

A snap target can sit inside forbidden territory — the playhead might be at
second 0.1 while the clip's fixed end is 0.4 away. Snapping first and clamping
second means the illegal suggestion is simply overruled. Reverse the two and a
target could pull the clip back out of legality after the clamp had fixed it.

#### What is NOT a snap target

Ruler ticks. At low zoom every tick becomes a magnet, dragging turns gritty, and
the ticks stop being a reading aid and become a grid nobody asked for. The targets
are things with *meaning*: the playhead, other clips' edges, the start and end of
the footage.

Also excluded: **the dragged clip's own edges.** Not an optimisation — leave them
in and the clip snaps to where it already is and cannot be moved at all.

#### A ref and a state, side by side, for opposite reasons

`Timeline` now holds both, three lines apart:

```ts
const scrubbing = useRef(false);                          // must NOT re-render
const [snapGuide, setSnapGuide] = useState<number|null>(null);  // must re-render
```

`scrubbing` is a fact about the gesture that nothing draws — a ref, so setting it
mid-drag costs nothing. `snapGuide` is a fact that *is* drawn, as the amber guide
line, so it has to be state. The choice is not stylistic: it follows from whether
anything renders the value.

The guide line matters more than it looks. Snapping without feedback feels like the
clip fighting you; with a line showing *what* it stuck to, it reads as assistance.
It is drawn beneath the playhead so the two stay distinguishable when a clip snaps
to the playhead itself.

`ClipBlock` reports `onGestureEnd` so the line can be cleared — and only if a drag
actually happened, since a plain click never showed one.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages; page loads
with no application errors; the snap arithmetic verified numerically against the
table above, including the Alt bypass and the tie-break. **The gesture itself is
not machine-verified** — blocks need a loaded video.

### Step 4 — Multi-select

**Files touched:** `timelineSlice.ts`, `timelineSelectors.ts`, `snapping.ts`,
`components/ClipBlock.tsx`, `components/Timeline.tsx`,
`components/MultiClipInspector.tsx` (new), `components/ClipInspector.tsx`,
`features/layout/components/PropertiesPanel.tsx`

**New concepts:** why a group edit needs its own reducer action; array identity in
selectors; snapshot timing versus dispatch; encoding a UI rule in a selector.

#### The model change

```diff
- selectedClipId: string | null;
+ selectedClipIds: string[];
+ selectionAnchorId: string | null;
```

The anchor is separate on purpose: the selection is a **set** with no meaningful
order, while "the clip you last clicked deliberately" is its own fact, and only the
anchor can tell a Shift-click what to measure a range *from*.

One value becoming a collection rippled through seven files, and the compiler found
every one — the same service the required `transform` field did in M6 Step 1.

#### What a click means

| gesture | action | why |
|---|---|---|
| plain click, clip not selected | `selectClip(id)` — replace | the ordinary case |
| plain click, clip **already** selected | **nothing** | see below |
| Ctrl/Cmd-click | `toggleClipSelection(id)` | add or remove |
| Shift-click | `selectClipRange(id)` | anchor → this clip, by TIME |
| click empty lane | `selectClip(null)` | clear |

That second row is the subtle one. Press on a member of a multi-selection intending
to drag the group, and replacing the selection would **collapse the group to one
clip the instant you touched it** — a group drag would be impossible. So a plain
click on an already-selected clip changes nothing and lets the drag proceed.

The cost, stated honestly: you cannot collapse a multi-selection by clicking one of
its members. Click empty space first. Real editors solve this by deciding on
*pointer-up* whether a drag happened; that is more machinery than this step needs.

Ranges are computed by **start time**, not array order — `track.clips` is in
creation order, so "between" has to mean between in time or the selection looks
arbitrary. And the anchor deliberately does not move on a Shift-click, which is what
makes a range adjustable by shift-clicking again.

#### The centrepiece: why `moveClips` exists

A group drag is **not** N calls to `updateClip`, and the reason is the clamp. Three
clips at `[1, 5, 10]`, gaps of `[4, 5]`, in a 96.4s video:

| gesture | clamp the DELTA once | clamp EACH clip |
|---|---|---|
| drag 3s **left** | `[0, 4, 9]` gaps `[4, 5]` ✅ | `[0, 2, 7]` gaps `[2, 5]` ❌ |
| drag 90s **right** | `[86.9, 90.9, 95.9]` gaps `[4, 5]` ✅ | `[91, 95, 95.9]` gaps `[4, 0.9]` ❌ |
| drag 2s right | `[3, 7, 12]` gaps `[4, 5]` | `[3, 7, 12]` gaps `[4, 5]` |

Clamping each clip separately lets the leftmost stop at 0:00 while the others carry
on, and the relative spacing — **the very thing you selected them together to
preserve** — is destroyed.

Look hard at the third row: when nothing is blocked, both approaches agree exactly.
That is what makes this bug dangerous. It survives casual testing and only appears
when the group touches a boundary. Verified numerically rather than by eye.

```ts
let allowed = finiteOr(deltaSeconds, 0);
for (const move of moves) {
  allowed = clamp(allowed, -move.startAtDragBegin, latestStart - move.startAtDragBegin);
}
for (const move of moves) { … clip.start = move.startAtDragBegin + allowed; }
```

Every clip narrows one shared delta, then the survivor is applied to all. **Only
code that can see every clip at once can enforce that** — which is the whole
argument for a new action instead of a loop in the component.

Note what the caller dispatches: the delta the dragged clip actually **took** after
snapping, not its absolute new start. Everyone else moves by the same amount.

#### Pitfall — a selector that builds an array re-renders forever

```ts
export const selectSelectedClipIds = (state) => state.timeline.selectedClipIds;
```

It returns the array *already in the store*, so its identity changes only when the
selection does. Write `.map` or `.filter` in a selector and `useSelector` gets a
brand-new reference on **every store update** — a fresh array is never `===` the
previous one — and every consumer re-renders forever. This is why there is no
`selectSelectedClips` returning clip objects: nothing needed it, and adding it would
have meant reaching for memoisation to undo a problem better avoided.

#### Pitfall — snapshot on the first MOVE, not on pointerdown

The group's starting positions have to be recorded once per gesture. The obvious
place is `pointerdown` — and it is wrong:

```
pointerdown → dispatch(selectClip(id))       // selection changes
            → but this component's props are STILL the pre-click selection
```

Snapshot there and you capture whatever was selected a moment ago. Waiting for the
first `pointermove` means the re-render has happened and `selectedClipIds` is what
the user actually has selected. The lazy snapshot is not a shortcut — it is the
*correct* timing, and it also removed the need for an `onGestureStart` callback.

#### Pitfall — a group must not snap to itself

`collectSnapTargets` took one `excludeClipId`; it now takes `excludeClipIds` and is
handed **the whole moving group**. Leave one moving clip in and it snaps to where it
already is; leave its fellow travellers in and the group snaps to its own members
and locks up.

Snapping still follows the clip **under the cursor** — that is the reference the
user is aiming with — and the delta it produces is applied to everyone.

#### Encoding a UI rule in a selector

`selectSoleSelectedClip` returns `null` unless **exactly one** clip is selected. The
full form edits one clip's name, start and length, and there is no obviously-right
meaning for typing one Start into five clips: should they all begin together, or keep
their spacing and shift? The second is what dragging already does, so the form does
not guess — several clips get `MultiClipInspector`, which offers only what is
unambiguous for a group (count, delete, clear).

Putting that rule in the selector rather than in the panel means the panel *cannot*
render the single-clip form for a group by mistake. The question was settled one
layer down.

#### A note on reading dev-server errors

Mid-way through this step the browser console showed import errors for
`selectSelectedClip` and `deleteClip` — both of which no longer existed anywhere.
They were **stale HMR entries**, logged when `next dev` recompiled after the selector
file was edited but before its consumers were. The console buffer accumulates across
recompiles and a reload does not clear it. Check that an error still matches the code
in front of you before chasing it; the page rendering correctly is the better signal.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages; grep confirms
no references to the removed `selectedClipId` / `selectSelectedClip` / `deleteClip` /
`excludeClipId` remain; the app renders with the new zero-selection state; the group
clamp verified numerically against the table above. **The gestures are not
machine-verified** — blocks need a loaded video.

### Step 5 — Duplicate + keyboard

**Files touched:** `frontend/utils/isTypingTarget.ts` (new),
`frontend/features/timeline/hooks/useTimelineShortcuts.ts` (new),
`frontend/features/player/hooks/usePlayerShortcuts.ts`,
`frontend/features/timeline/timelineSlice.ts`,
`frontend/features/timeline/components/Timeline.tsx`,
`frontend/components/layout/EditorShell.tsx`

**New concepts:** two global key handlers that must not collide; copying nested
mutable state; naming a payload field for all its callers rather than the first.

#### The keyboard conflict, resolved rather than papered over

`usePlayerShortcuts` already owns the arrow keys **twice**: ±5s, and ±0.1s with
Shift. So arrow-nudge was never available. Two `window` listeners both calling
`preventDefault` on the same key would leave the winner up to listener registration
order, which is not a design — it is a race that happens to work.

So nudge is bound to **`,` and `.`** (Shift for a 1s step instead of 0.1s). They are
adjacent on the keyboard, unclaimed, and the convention in several real editors.

The two hooks are mounted side by side in `EditorShell` with a comment saying they
share no bindings — because the next person to add a shortcut needs to know that is
an invariant, not an accident.

#### Extracted on its second use

`usePlayerShortcuts` had the "is the user typing?" guard inline. `useTimelineShortcuts`
needs exactly the same rule, so it moved to `utils/isTypingTarget.ts`.

This one earns its extraction more than most: without it, typing `Q, E` into the Keys
field fires the shortcuts bound to those keystrokes, and pressing **Delete** to fix a
typo in the Name box deletes the clip you were editing. Two copies of a guard like
that is how they drift apart, and the failure is silent.

#### One early return that does real work

```ts
if (selectedClipIds.length === 0) return;
```

Every shortcut here acts on the selection, so with nothing selected there is nothing
to do — and, crucially, **no key to swallow**. Backspace still reaches the browser,
Ctrl+D still bookmarks. A global handler that calls `preventDefault` for keys it is
not going to act on is a bug that only shows up as "the browser feels broken".

Where it *does* act, `preventDefault` is mandatory: the browser's own Ctrl+D is
"bookmark this page", and without it you get a bookmark dialog on every duplicate.

#### Duplicate: one shared offset, again

The copies are shifted by the **span of the whole selection**, so the new group lands
just past the old one with its internal spacing intact. Offsetting each clip by its
own length would scramble a group's rhythm — the same reasoning as the shared delta
in `moveClips`. Verified numerically, in a 96.4s video (last legal start 95.9):

| selection | offset | copies land at | |
|---|---|---|---|
| one clip at 5 (2s) | 2 | `[7]` | immediately after |
| group `[1, 5, 10]`, gaps `[4, 5]` | 11 | `[12, 16, 21]`, gaps `[4, 5]` | spacing intact |
| group `[90, 94]` near the end | **1.9** | `[91.9, 95.9]`, gaps `[4]` | offset shrank to fit |
| a clip already at 95.9 | 0 | `[95.9]` | copy sits on the original |

The third row is the interesting one: the offset is narrowed until *every* copy fits
inside the footage, so the group stays legal and keeps its shape rather than having
its last member clamped separately. The fourth is the honest fallback — when there is
no room at all, the copy lands on top of the original. Visible and draggable, which
beats silently creating a clip past the end of the video where nothing would ever
render it.

The copies are selected afterwards, not the originals, because the thing you almost
always want next is to drag what you just made.

#### Pitfall — a spread copy shares its nested objects

```ts
// WRONG: the copy and the original share one transform object and one keys array
const copy = { ...clip, id: crypto.randomUUID() };
```

`copyClip` copies every nested value explicitly: `{ ...clip.transform }` and
`{ keys: [...clip.props.keys] }`. This is the `{ ...DEFAULT_TRANSFORM }` lesson from
M6 in a new place — two objects sharing one piece of mutable state.

Worth being precise about why it matters here, because it is currently *harmless*:
`updateClip` replaces `transform` and `props` wholesale rather than mutating them, so
today nothing would notice. But that is a property of code in another file that could
change at any time, and the bug it would produce — editing one clip silently changing
another — is exactly the kind nobody suspects. Two lines of copying removes the
possibility rather than relying on a distant invariant.

`copyClip` also lists the base fields one by one instead of spreading, so a new field
on `ClipBase` stops it compiling until it has been considered — the same compile-time
coverage the transform block gets in `updateClip`.

#### Pitfall — never grow an array you are iterating

```ts
const additions: OverlayClip[] = [];
for (const clip of track.clips) { … additions.push(copy); }
track.clips.push(...additions);
```

Pushing straight into `track.clips` inside the loop would walk into the copies just
added and duplicate those too — forever, until the browser gives up. Collect first,
push after.

#### Naming a payload for all its callers

`moveClips` originally took `startAtDragBegin`. A keyboard nudge is not a drag, and it
passes the clip's *current* start — so the field is now `fromStart`, and the action
serves both callers with no change to its logic. A nudge **is** a group move with a
keyboard-sized delta, which is why it reuses `moveClips` and inherits the shared-delta
clamp that keeps a group's spacing when one member hits an end.

Naming a parameter after the first caller quietly discourages the second from reusing
it.

**Verified:** `npm --prefix frontend run build` clean, 4/4 static pages; the app
renders; the duplicate offset verified numerically against the table above. **The
shortcuts themselves are not machine-verified** — they act on a selection, which needs
clips, which needs a loaded video.

### Step 6 — Guard rails + verification

**Files touched:** `docs/Learning.md`, `docs/Roadmap.md`, `CLAUDE.md`

**New concepts:** none — this step is a review pass, and finding nothing new to fix
is a legitimate result.

#### Who owns which invariant now

M7 added three actions that write clip data. The point of this pass was to check
that none of them quietly bypasses a rule `updateClip` already enforces:

| action | what it may change | invariants applied | verdict |
|---|---|---|---|
| `updateClip` | any one clip | start/duration vs footage, fade ≤ duration, x/y clamped + rounded, scale/opacity clamped, rotation folded, NaN refused | unchanged |
| `moveClips` | `start` of many | one **shared** delta clamped so every clip stays in `[0, videoEnd − MIN]`; NaN refused | correct |
| `duplicateClips` | adds clips | one shared offset clamped so every copy fits; copies inherit already-valid duration, fades and transform | correct |
| `deleteClips` | removes clips | prunes `selectedClipIds` and clears `selectionAnchorId` if it pointed at a deleted clip | correct |

`moveClips` and `duplicateClips` never touch `duration`, `fadeIn`, `fadeOut` or
`transform`, so they cannot invalidate those — and the values they copy were already
legal when `updateClip` last wrote them. That is the payoff of having put the rules in
one place in M6: two new writers arrived and needed no new validation.

#### A gap this pass DID find (not fixed here)

**Open a shorter video and existing clips can end up beyond its end.** `videoOpened`
resets the player slice — status, duration, currentTime — but never touches
`state.timeline.tracks`. So loading a 10-second clip after a 90-second one leaves
overlays at second 80: unreachable, unrenderable, and invisible in a timeline that
now only extends to 10.

Every clamp in the codebase is applied *when a value is written*. This is the other
case: the value was legal when written, and the **bounds moved underneath it**. The
fix is an action along the lines of `clampClipsToVideo({ videoDuration })` dispatched
when a new video loads — but that is new behaviour, not a guard rail on existing
behaviour, so it is recorded here rather than smuggled into a verification step.

It is not urgent: clips do not survive a reload yet (persistence is M9), so this only
bites within a single session, and M9 will need exactly the same action for loading a
project file against a different video.

#### Two housekeeping findings

| file | lines | guideline | note |
|---|---|---|---|
| `timelineSlice.ts` | 503 | — | 13 reducers, two concerns |
| `Timeline.tsx` | 429 | ≤ ~300 | over the component limit |

Neither is broken; both are over the size we said we would keep to, and pretending
otherwise in a verification step would defeat the point of having one.

- **`timelineSlice.ts`** holds the viewport (zoom, pan) and the clip data
  deliberately — that decision is recorded in CLAUDE.md §8. At 503 lines the
  deliberate choice is starting to cost more than it saves; the natural seam is
  exactly where the `--- clip data actions ---` comment already sits.
- **`Timeline.tsx`** grew by ~200 lines across M7 for gesture handling. The natural
  extraction is a `useClipGestures` hook holding `groupOrigins`, the snap-target
  assembly and the three conversions, leaving the component to render.

Both are refactors, not fixes, so they want their own step and an explicit go-ahead
rather than being folded into a checklist pass.

#### The M7 manual checklist

Nothing automated can see any of this. Requires a loaded video.

**Move (Step 1)**
1. Drag a block sideways → it tracks your hand 1:1; Start updates live in Properties.
2. Click without moving → selects, and the clip does **not** shift (the 3px threshold).
3. Zoom in hard, drag the same distance → retimes by much less.
4. Drag hard left → parks at 0:00, never negative. Hard right → stops short of the end.

**Resize (Step 2)**
5. Hover the left/right 6px → `ew-resize` cursor and a pale bar.
6. Drag the right edge → length changes, start stays.
7. Drag the **left** edge → start and length both change and the clip's **right end
   does not move**. The one to watch.
8. Left edge hard left past 0:00 → stops at 0, end still unmoved.
9. Left edge dragged right past the right end → parks at 0.5s, does not invert.
10. Fade in 3 on a 4s clip, then trim to ~1s → the fade follows down.
11. Zoom right out so a block is tiny → whole block moves, no resize zones.

**Snap (Step 3)**
12. Drag one clip's edge near another's → clicks into place, **amber line** appears.
13. Drag so its **end** meets a neighbour's start → butts up flush, length unchanged.
14. Drag near the playhead → snaps to it; amber line under the red one.
15. Hold **Alt** while dragging → no snapping, no amber line; release mid-drag and it returns.
16. Release after a snap → amber line disappears. Plain-click → no line ever appears.

**Multi-select (Step 4)**
17. Ctrl-click two clips → Properties reads "2 clips selected".
18. Drag one of them → both move, spacing preserved **exactly**.
19. Drag the pair into 0:00 → the leader stops and **the gap does not change**.
20. Shift-click a third → the range between fills in.
21. Ctrl-click a selected clip → it drops out, the others stay.
22. Select two, drag near a third unselected clip → snaps to it, and the pair never
    snaps to each other.
23. Select exactly one → the **full** form returns.
24. Resize while several are selected → only the one under the cursor changes.

**Keyboard (Step 5)**
25. Ctrl+D → copy lands immediately after, the **copy** is selected, no bookmark dialog.
26. Select two, Ctrl+D → both copy past the group, gap preserved.
27. Ctrl+D near the end of the video → the copy stays inside the footage.
28. `.` / `,` → ±0.1s; Shift → ±1s. Watch Start.
29. Nudge a group into 0:00 → leader stops, gap unchanged.
30. Delete → selected clips and their overlays go together.
31. Click into the **Name** field, type a comma, press Delete → the clip must **not**
    move or vanish. That is `isTypingTarget`.
32. ← / → → still seeks ±5s, no nudging.

#### Verification status — read this honestly

| gate | result |
|---|---|
| `npm --prefix frontend run build` | ✅ clean after every step, 4/4 static pages |
| App renders, no application errors | ✅ (only the expected `127.0.0.1:3939/health` refusals) |
| Group-move clamp | ✅ verified numerically — spacing preserved where per-clip clamping destroys it |
| Resize-left end-stays-put | ✅ verified numerically, including the naive-vs-guarded comparison |
| Snap arithmetic + Alt bypass + tie-break | ✅ verified numerically |
| Duplicate offset, incl. near the video end | ✅ verified numerically |
| `npm run build` (full gate) | ⛔ **cannot run on this machine** |
| Manual checklist (32 items) | ⛔ **not yet run** |

Same shape as M6: **M7 is frontend-verified, not fully-gated.** The blocker is the
environment (nested PowerShell cannot launch executables; MSVC absent), not the code.
Three checklists are now outstanding — M5's 10, M6's 16 and M7's 32 — and the
overlap is deliberate: M7 rewrote the gesture handling that M5 and M6 relied on.

## Appendix — file map (M2 so far)

| File | Role |
|------|------|
| `frontend/app/layout.tsx` | root frame, mounts fonts + Providers |
| `frontend/app/providers.tsx` | mounts the Redux `<Provider>` |
| `frontend/app/page.tsx` | renders `<EditorShell/>` — the whole app |
| `frontend/store/store.ts` | creates store, registers reducers, exports RootState/AppDispatch |
| `frontend/hooks/useRedux.ts` | typed `useAppDispatch` / `useAppSelector` |
| `frontend/components/layout/EditorShell.tsx` | the one grid that holds the entire editor |
| `frontend/components/layout/MenuBar.tsx` | top menu bar; dropdown menus, View → Reset Layout dispatches resetLayout |
| `frontend/components/layout/StatusBar.tsx` | bottom bar; reads backend status + fires health check |
| `frontend/components/layout/Panel.tsx` | generic panel: title + children slot; `h-full` so percentage heights inside resolve |
| `frontend/components/layout/PanelDivider.tsx` | drag handle (oriented vertical/horizontal) → resizePanel |
| `frontend/utils/clamp.ts` | clamp(value, min, max) helper |
| `frontend/utils/isTypingTarget.ts` | "is the user typing?" guard shared by both keyboard hooks |
| `frontend/features/timeline/hooks/useTimelineShortcuts.ts` | Delete / Ctrl+D duplicate / `,` `.` nudge, all acting on the selection |
| `frontend/features/system/…` | system slice + selectors + status presentation + backend client |
| `frontend/features/layout/layoutSlice.ts` | layout state + resizePanel/resetLayout |
| `frontend/features/layout/layoutSelectors.ts` | selectPanels |
| `frontend/features/layout/components/AssetsPanel.tsx` | left panel: placeholder asset list |
| `frontend/features/layout/components/PreviewPanel.tsx` | center panel: video preview placeholder |
| `frontend/features/layout/components/PropertiesPanel.tsx` | right panel: picks none / one (ClipInspector) / several (MultiClipInspector) |
| `frontend/features/timeline/components/MultiClipInspector.tsx` | what Properties shows for a multi-selection: count, delete all, clear |
| `frontend/features/timeline/components/ClipInspector.tsx` | edit form for the selected clip: name, start, length, per-kind props, delete; renders TransformFields |
| `frontend/features/timeline/components/Field.tsx` | shared labelled form row + INPUT class string (extracted on its second use) |
| `frontend/features/timeline/components/TransformFields.tsx` | geometry half of the form: X/Y/Scale/Rotation/Opacity as slider+number pairs, plus Reset |
| `frontend/features/layout/components/TimelinePanel.tsx` | bottom: ruler + empty track placeholder |
| `frontend/features/player/playerSlice.ts` | player state + videoOpened/seekBy/setTime/… |
| `frontend/features/player/playerSelectors.ts` | selectPlayer |
| `frontend/features/player/formatTime.ts` | seconds → "m:ss" |
| `frontend/features/player/components/VideoPicker.tsx` | hidden file input reacting to pickRequest |
| `frontend/features/player/components/VideoPlayer.tsx` | owns `<video>`; event bridge + seek bridge |
| `frontend/features/player/components/TransportBar.tsx` | play/pause, seekbar, time readout |
| `frontend/features/player/hooks/usePlayerShortcuts.ts` | Space/arrows/Ctrl+O dispatch commands |
| `frontend/features/timeline/timelineSlice.ts` | viewport (zoom, viewportStart) + clip data; setZoom/panBy/zoomAt/fitToWindow/clampViewport, addClip/selectClip/updateClip/deleteClip |
| `frontend/features/timeline/timelineSelectors.ts` | selectTimeline / selectZoom / selectViewportStart / selectTracks / selectSelectedClipIds / selectSoleSelectedClip (null unless exactly one) |
| `frontend/features/timeline/timelineCoords.ts` | pure timeToX / xToTime / tickStep / visibleTicks + viewport limits (minZoomFor / maxViewportStart) |
| `frontend/features/timeline/types.ts` | overlay data model: KeyboardClip \| TextClip union, Track, ClipPatch, ClipTransform (absolute seconds; geometry as 0–1 fractions) |
| `frontend/features/timeline/activeClips.ts` | pure isClipActive / activeClipsAt — which overlays are live at second T |
| `frontend/features/timeline/clipOpacity.ts` | pure clipOpacityAt — the fade envelope multiplied into the clip's base opacity |
| `frontend/features/timeline/snapping.ts` | pure snapTime / snapMovedClip / collectSnapTargets + SNAP_PX — edges stick to the playhead and neighbouring clips |
| `frontend/features/timeline/newClip.ts` | pure makeNewClip + DEFAULT_TRANSFORM — defaults for a freshly added overlay |
| `frontend/features/timeline/overlayCoords.ts` | pure draggedPosition + roundPosition — pointer pixels → 0–1 frame fractions (mirror of xToTime) |
| `frontend/features/timeline/components/TimelineToolbar.tsx` | + Keys / + Text at the playhead, and Fit |
| `frontend/features/timeline/components/OverlayCanvas.tsx` | draws the live overlays on the video preview; measures the video box; places each overlay from its own ClipTransform (centre-anchored, frame-relative scale); drag-to-position with pointer capture |
| `frontend/features/timeline/components/Timeline.tsx` | ruler + track lanes + playhead; scrub-drag, wheel zoom/pan, Fit; TimelinePanel renders it |
| `frontend/features/timeline/components/ClipBlock.tsx` | one overlay drawn as a block; colour per kind, click to select, drag to retime, edge-drag to trim (owns the gesture and picks move/resize-left/resize-right from coordinates; reports pixels — parent converts) |

**Retired in Step 6 (deleted):** `LayoutSizesDemo`, `LayoutPreview`,
`HelloGuideForge`, `SystemStatusCard`. The app now boots directly into the
editor shell.
