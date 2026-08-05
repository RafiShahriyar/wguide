# Renderer (Design)

Milestone 8: turn the timeline into an MP4. Design baseline written now so the
data model (M4/M5) never contradicts the exporter.

## Pipeline

```
Timeline (JSON) + assets + source video
        |
        v
Go backend: render/          <- reads project, computes per-frame overlays
        |
        v
ffmpeg                        <- encode overlays + audio into MP4
        |
        v
out.mp4
```

## Strategy

- The frontend sends the serialized project to the Go backend (`render.Export`).
- Go computes per-frame overlay renders (keyboards, text, arrows, images) for
  each frame at the target FPS/resolution.
- Go drives ffmpeg via its CLI (library is too heavy); frames can be fed
  through ffmpeg pipes or a temp directory, then muxed.
- Progress is reported back to the frontend over HTTP (polling or SSE) so the
  UI can show a progress bar.

## Responsibilities split

- Frontend: authoring only. Never touches ffmpeg.
- Go: probing (`ffprobe`), compositing, encoding. The source of truth for
  render math.
- Rust/Tauri: keeps Go alive and (later) reports render lifecycle events.

## Anti-goals for M1

- No rendering yet. The `/health` endpoint only proves the sidecar is alive.
- No audio pipeline until M8.
