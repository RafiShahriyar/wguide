# Project File Format (Design)

Milestone 9: `guideforge.project` — a single JSON file that fully describes a
GuideForge project. Design baseline written now so slices never store data that
can't serialize cleanly.

## Layout

```jsonc
{
  "schemaVersion": 1,
  "project": {
    "name": "Camellya Rotation Guide",
    "settings": {
      "width": 1920,
      "height": 1080,
      "fps": 60
    }
  },
  "assets": [
    {
      "id": "asset-1",
      "type": "video",
      "path": "recording.mp4",        // relative to project dir
      "name": "Main rotation run"
    }
  ],
  "timeline": {
    "duration": 32.5,
    "tracks": [
      {
        "id": "track-1",
        "name": "Keyboard",
        "clips": [
          {
            "id": "clip-1",
            "assetId": null,
            "kind": "keyboard",
            "start": 0.5,
            "duration": 4.2,
            "name": "Intro key sequence",
            "props": {
              "keys": ["E", "LMB", "Swap"]
            }
          }
        ]
      }
    ]
  }
}
```

## Rules

- **Absolute times only** — no viewport/pixel values. Zoom and pan are UI state,
  never saved.
- **Asset paths relative to the project file**, so projects are portable.
- `schemaVersion` gates migrations; the loader must reject unknown/newer
  versions with a clear error.
- Backend owns nothing about the file in M1 — the frontend serializes and
  deserializes it. In M9, the Go backend validates and (later) renders from it
  directly.
