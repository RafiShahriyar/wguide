# Redux Design

Redux Toolkit owns all application state. Every slice owns exactly one
responsibility; there is no giant `editorSlice`.

## Slices

| Slice | Responsibility | Status |
|-------|----------------|--------|
| `system` | app identity, backend connectivity | M1 |
| `player` | video source, play/pause, current time | M3 |
| `timeline` | tracks, clips, playhead, zoom | M4 |
| `overlay` | overlay instances and their geometry | M5 |
| `properties` | inspector editing of the selected object | M6 |
| `selection` | current/multi selection, clipboard | M7 |
| `project` | new/open/save, dirty state, undo/redo | M9 |

## Shape

```ts
// M1 system slice
interface SystemState {
  appName: string;
  appVersion: string;
  backend: {
    status: "idle" | "checking" | "connected" | "error";
    address: string;
    version: string | null;
    checkedAt: number | null;
    error: string | null;
  };
}
```

## Conventions

- Slices live in `frontend/features/<feature>/<feature>Slice.ts`.
- Selectors live next to the slice in `<feature>Selectors.ts`.
- Async work uses `createAsyncThunk` with `rejectValue` for typed errors.
- UI never reads `state` directly — only through selectors.
- Typed hooks (`useAppDispatch`, `useAppSelector`) are the only entry points;
  components never import `store` itself.

## The M1 flow

`SystemStatusCard` (client component) dispatches `checkBackendHealth` on mount:

```
dispatch(checkBackendHealth())
  -> pending  (status: "checking")
  -> fetch   http://127.0.0.1:3939/health   (3s AbortController timeout)
  -> fulfilled (status: "connected", version, checkedAt)
  -> rejected  (status: "error", error message)
```

## Backend client

All HTTP to the Go sidecar goes through a thin per-feature client
(`features/system/backendClient.ts`) so the transport can change without
touching components.
