# Implement the repellent placeables

The repellent tool creates areas unicorns avoid.

- Select ☘️ repellent, tap open ground: the item is placed there with a visible radius circle. Placing consumes one unit of stock.
- Unicorn steering treats repellent radii as areas to avoid/steer around.
- Placeables expire after a while so the garden doesn't fill up; stock limits how many can ever be placed, expiry keeps the field from staying full.
- Placing decrements the tool's stock badge; at zero stock nothing can be placed.

## Acceptance criteria

- Unicorns route around a placed repellent's radius instead of through it.
- Placeables show their radius and eventually disappear.
- Placing decrements the tool's stock badge; at zero stock nothing can be placed.