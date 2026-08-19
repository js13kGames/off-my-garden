# Add the leprechaun with tap-to-move

Add the player character: a small procedurally-drawn leprechaun standing in the
garden. Tapping open ground makes him run there.

- Movement takes real time (he is a character, not a cursor); speed tuned so
  crossing the garden takes a meaningful moment.
- He walks around beds or at least visibly through the walkways — a straight-line
  move is acceptable for the POC if it reads well.
- A simple walk animation (bobbing/legs) tied to his movement.

## Acceptance criteria

- Tapping open ground moves the leprechaun there over time; tapping again retargets
  him mid-run.
- Taps on the HUD/toolbar strips do not move him.
