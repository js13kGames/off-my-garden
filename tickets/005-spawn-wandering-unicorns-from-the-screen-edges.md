# Spawn wandering unicorns from the screen edges

Add unicorns that enter the garden and wander around harmlessly.

- 6–8 spawn points around the screen edges.
- Before a unicorn enters, a small edge warning marker (`!`) appears at its spawn
  point for a beat.
- Spawned unicorns wander the open walkways between beds (simple steering toward
  roaming waypoints is enough), eventually leaving by an edge.
- Chunky procedural unicorn drawing (body, head, horn, legs); simple walk animation.
- Cap simultaneous unicorns at 2–4 for now.

## Acceptance criteria

- Unicorns are announced by an edge marker, enter, wander between the beds without
  entering them, and leave.
- Never more than the configured cap on screen at once.
