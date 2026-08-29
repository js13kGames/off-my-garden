# Implement the repellent and attractor placeables

The two placeable tools share one mechanic with opposite sign.

- Select ☘️ repellent or 🌈 attractor, tap open ground: the item is placed there
  with a visible radius circle. Placing consumes one unit of that tool's stock.
- Unicorn steering treats attractors as lure targets (walk toward it, linger) and
  repellent radii as areas to avoid/steer around.
- Placeables expire after a while so the garden doesn't fill up; stock limits how
  many can ever be placed, expiry keeps the field from staying full.
- Attraction should be able to override a flower NOTICE — that's the point of the
  tool.

## Acceptance criteria

- A placed attractor visibly pulls wandering unicorns toward it, including ones
  headed for a flower.
- Unicorns route around a placed repellent's radius instead of through it.
- Placeables show their radius and eventually disappear.
- Placing decrements the tool's stock badge; at zero stock nothing can be placed.
