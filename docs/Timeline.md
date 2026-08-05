# Timeline (Design)

The timeline is the heart of GuideForge. Written as the design baseline for
Milestone 4; implementation notes will be appended when the feature lands.

## Mental model

A timeline is a time axis plus tracks. Everything is measured in **seconds**
(double), and pixels are derived from a **zoom** factor (px per second).

```
0----5----10----15----20  <- seconds (ruler)
    |  [Keyboard  ]        <- Track 1
         [  Text   ]       <- Track 2
             [Arrow]       <- Track 3
     ^ playhead at 2.5s
```

## Concepts

- **Playhead**: current time; scrubbable by dragging; position =
  `currentTime * zoom`.
- **Track**: owns clips (overlays). Order = vertical z-order.
- **Clip**: an overlay instance with `start`, `duration`, `name`, `kind`.
- **Ruler**: labels at nice intervals chosen from zoom (1/2/5/10/30/60s…).

## Coordinates

- `timeToX(t) = (t - viewportStart) * zoom`
- `xToTime(x) = viewportStart + x / zoom`

Zoom and pan are viewport concerns, not data — clips always store absolute
time. This keeps undo/save/render deterministic.

## Milestone 4 checklist

- [ ] Playhead renders and drags to a frame-accurate time.
- [ ] Mouse wheel zooms centered on the cursor.
- [ ] Horizontal pan via scroll/drag.
- [ ] Ruler ticks adapt to zoom.
- [ ] Performance holds at 60fps for a 30 min timeline.
