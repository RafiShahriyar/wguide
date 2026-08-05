# GuideForge — Learning Notes

A beginner-friendly, living document that records the *explanations* behind the
code, step by step. Append to it as we build. Read it like notes from a mentor.

## How to use this doc

- Each **Step** corresponds to one component/milestone of work.
- Every step has the same shape: files touched → data flow → concepts → pitfalls.
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

**Retired in Step 6 (deleted):** `LayoutSizesDemo`, `LayoutPreview`,
`HelloGuideForge`, `SystemStatusCard`. The app now boots directly into the
editor shell.
