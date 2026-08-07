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
| `frontend/features/layout/components/PropertiesPanel.tsx` | right panel: placeholder message |
| `frontend/features/layout/components/TimelinePanel.tsx` | bottom: ruler + empty track placeholder |
| `frontend/features/player/playerSlice.ts` | player state + videoOpened/seekBy/setTime/… |
| `frontend/features/player/playerSelectors.ts` | selectPlayer |
| `frontend/features/player/formatTime.ts` | seconds → "m:ss" |
| `frontend/features/player/components/VideoPicker.tsx` | hidden file input reacting to pickRequest |
| `frontend/features/player/components/VideoPlayer.tsx` | owns `<video>`; event bridge + seek bridge |
| `frontend/features/player/components/TransportBar.tsx` | play/pause, seekbar, time readout |
| `frontend/features/player/hooks/usePlayerShortcuts.ts` | Space/arrows/Ctrl+O dispatch commands |

**Retired in Step 6 (deleted):** `LayoutSizesDemo`, `LayoutPreview`,
`HelloGuideForge`, `SystemStatusCard`. The app now boots directly into the
editor shell.
