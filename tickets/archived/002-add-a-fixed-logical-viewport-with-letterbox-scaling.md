# Add a fixed logical viewport with letterbox scaling

Replace TurboToot's full-window canvas sizing with the fixed logical viewport this
game requires: all game code works in 360×640 logical portrait coordinates, and the
canvas scales that viewport to the physical screen, centered and letterboxed.

- One garden = one screen: no camera, no scrolling.
- Pointer input (mouse and touch) is converted from screen to logical coordinates.
- Game geometry is identical on mobile and desktop; desktop just gets letterbox
  margins.

## Acceptance criteria

- The full 360×640 playfield is visible without scrolling on a portrait phone, a
  desktop window, and a landscape window (letterboxed).
- A tap/click anywhere reports correct logical coordinates (verify with a debug
  marker drawn at the tapped point).
- Resizing the window rescales without distorting the aspect ratio.
