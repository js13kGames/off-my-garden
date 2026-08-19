# Implement the noisemaker

The noisemaker belongs to the leprechaun and requires proximity.

- Select 🔊, tap a location: the leprechaun runs there.
- When he arrives (or is already close enough), he emits visible sound waves;
  unicorns within the noise radius get scared and flee away from him (interrupting
  NOTICE or walk-to-flower states).
- Scared unicorns calm back to wandering after a moment or leave by an edge.

## Acceptance criteria

- Selecting noise and tapping near unicorns sends the leprechaun there; on arrival
  the sound effect plays visually and nearby unicorns turn and flee.
- Unicorns outside the radius ignore it.
- A unicorn mid-NOTICE or walking toward a flower aborts when scared.
