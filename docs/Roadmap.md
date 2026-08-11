# GuideForge Roadmap

GuideForge is a desktop video editor for game guide creators. Users pause the
timeline and place keyframes to annotate character rotations and ability
rotations (e.g. Wuthering Waves, Genshin, ZZZ).

## Version 1 — 10 milestones

| # | Milestone | Goal | Status |
|---|-----------|------|--------|
| 1 | Project Foundation | Tauri window + React + Redux + Go backend connected ("Hello GuideForge") | ✅ Done |
| 2 | Layout System | Editor shell: menu bar, assets / preview / properties panels, timeline area | ✅ |
| 3 | Video Player | Open videos, play/pause, seek, current-time display | ✅ |
| 4 | Timeline Engine | Custom timeline: playhead, drag, zoom, scroll | ✅ |
| 5 | Overlay Engine | Keyboard / mouse / arrow / text / image overlays on one interface | ✅ keyboard + text |
| 6 | Property Inspector | Opacity, scale, rotation, position, animation, duration | ⬜ Next |
| 7 | Timeline Editing | Move, resize, delete, duplicate, multi-select, snap | ⬜ |
| 8 | Rendering | Timeline -> Go backend -> ffmpeg -> MP4 export | ⬜ |
| 9 | Project Files | New / open / save / save-as (`guideforge.project`) | ⬜ |
| 10 | Polish | Shortcuts, undo/redo, settings, themes, autosave, crash recovery | ⬜ |

## Future versions (post-v1)

- **AI prompt**: natural-language guide generation -> timeline.
- **Computer vision**: detect dodge / echo / liberation / skill / swap events
  from gameplay footage and key them automatically.
- **Plugin system**: game-specific overlay packs (Wuwa, Genshin, ZZZ, League,
  Valorant).

## Git strategy

- `main` — stable milestones only.
- `dev` — integration branch; features are squash-merged here.
- `feature/<milestone>` — one branch per milestone.
- Each merged milestone is tagged and manually testable.

## Testing strategy

Every milestone ships with a manual test checklist (see each milestone's
acceptance criteria in its PR/commit). Examples:

- **M1**: window opens, Redux state updates, Go `/health` responds, backend
  process dies with the app.
- **M3**: open MP4, play/pause, seek, time updates, large videos don't block UI.
- **M4**: playhead drags to seek, wheel zooms anchored at the cursor, shift-wheel
  pans, the ruler relabels itself at every zoom, Fit shows the whole video and
  panning stops at both ends.
- **M5**: `+ Keys` / `+ Text` create a clip at the playhead, the block appears in
  the lane at the right second, the overlay shows on the video only between
  start and start+length, clicking a block selects it without seeking, the
  Properties panel edits name / start / length / keys / text / colour, and
  Delete removes both the block and the overlay.

**Known gaps after M5** (deliberate, scheduled): nothing persists across a
restart (M9), clips cannot be dragged or resized on the timeline (M7), overlays
have no position or size of their own (M6), and only the `keyboard` and `text`
kinds exist — mouse / arrow / image are still to come.
