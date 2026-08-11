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
| `frontend/components/layout/Panel.tsx` | generic panel: title + children slot |
| `frontend/components/layout/PanelDivider.tsx` | drag handle (oriented vertical/horizontal) → resizePanel |
| `frontend/utils/clamp.ts` | clamp(value, min, max) helper |
| `frontend/features/system/…` | system slice + selectors + status presentation + backend client |
| `frontend/features/layout/layoutSlice.ts` | layout state + resizePanel/resetLayout |
| `frontend/features/layout/layoutSelectors.ts` | selectPanels |
| `frontend/features/layout/components/AssetsPanel.tsx` | left panel: placeholder asset list |
| `frontend/features/layout/components/PreviewPanel.tsx` | center panel: video preview placeholder |
| `frontend/features/layout/components/PropertiesPanel.tsx` | right panel: renders ClipInspector for the selected clip |
| `frontend/features/timeline/components/ClipInspector.tsx` | edit form for the selected clip: name, start, length, per-kind props, delete |
| `frontend/features/layout/components/TimelinePanel.tsx` | bottom: ruler + empty track placeholder |
| `frontend/features/player/playerSlice.ts` | player state + videoOpened/seekBy/setTime/… |
| `frontend/features/player/playerSelectors.ts` | selectPlayer |
| `frontend/features/player/formatTime.ts` | seconds → "m:ss" |
| `frontend/features/player/components/VideoPicker.tsx` | hidden file input reacting to pickRequest |
| `frontend/features/player/components/VideoPlayer.tsx` | owns `<video>`; event bridge + seek bridge |
| `frontend/features/player/components/TransportBar.tsx` | play/pause, seekbar, time readout |
| `frontend/features/player/hooks/usePlayerShortcuts.ts` | Space/arrows/Ctrl+O dispatch commands |
| `frontend/features/timeline/timelineSlice.ts` | viewport (zoom, viewportStart) + clip data; setZoom/panBy/zoomAt/fitToWindow/clampViewport, addClip/selectClip/updateClip/deleteClip |
| `frontend/features/timeline/timelineSelectors.ts` | selectTimeline / selectZoom / selectViewportStart / selectTracks / selectSelectedClipId |
| `frontend/features/timeline/timelineCoords.ts` | pure timeToX / xToTime / tickStep / visibleTicks + viewport limits (minZoomFor / maxViewportStart) |
| `frontend/features/timeline/types.ts` | overlay data model: KeyboardClip \| TextClip union, Track, ClipPatch (absolute seconds) |
| `frontend/features/timeline/activeClips.ts` | pure isClipActive / activeClipsAt — which overlays are live at second T |
| `frontend/features/timeline/newClip.ts` | pure makeNewClip — defaults for a freshly added overlay |
| `frontend/features/timeline/components/TimelineToolbar.tsx` | + Keys / + Text at the playhead, and Fit |
| `frontend/features/timeline/components/OverlayCanvas.tsx` | draws the live overlays on the video preview; measures the video box |
| `frontend/features/timeline/components/Timeline.tsx` | ruler + track lanes + playhead; scrub-drag, wheel zoom/pan, Fit; TimelinePanel renders it |
| `frontend/features/timeline/components/ClipBlock.tsx` | one overlay drawn as a block; presentational, colour per kind, click to select |

**Retired in Step 6 (deleted):** `LayoutSizesDemo`, `LayoutPreview`,
`HelloGuideForge`, `SystemStatusCard`. The app now boots directly into the
editor shell.
