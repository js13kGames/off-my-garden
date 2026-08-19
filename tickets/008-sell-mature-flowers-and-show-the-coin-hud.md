# Sell mature flowers and show the coin HUD

Add the economy's read side: tapping a mature (halo) flower sells it.

- On tap: `+N` coin popup floats up, the flower regresses to stage 0 and regrows.
- Immature flowers ignore taps.
- Add the compact top HUD strip showing the coin total (wave counter comes later).
- Coins are score for the POC — nothing to spend them on yet.

## Acceptance criteria

- Tapping a mature flower shows the +coins popup, increments the HUD total, and
  resets the flower to stage 0.
- Tapping a growing flower does nothing.
