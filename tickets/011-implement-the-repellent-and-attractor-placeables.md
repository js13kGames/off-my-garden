# Implement the repellent and attractor placeables

The two placeable tools share one mechanic with opposite sign.

- Select ☘️ repellent or 🌈 attractor, tap open ground: the item is placed there
  with a visible radius circle.
- Unicorn steering treats attractors as lure targets (walk toward it, linger) and
  repellent radii as areas to avoid/steer around.
- Placeables expire after a while (or are limited to one of each active at a time —
  pick whichever is simpler) so the garden doesn't fill up.
- Attraction should be able to override a flower NOTICE — that's the point of the
  tool.

## Acceptance criteria

- A placed attractor visibly pulls wandering unicorns toward it, including ones
  headed for a flower.
- Unicorns route around a placed repellent's radius instead of through it.
- Placeables show their radius and eventually disappear.
