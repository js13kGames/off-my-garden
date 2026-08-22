# Make plants grow one cycle per wave

Each wave brings in unicorns that will stump flowers. Flowers get exactly one
growth cycle per wave, driven by time within the wave — not by wave transitions.

- When a wave starts, every flower resets to stage 0 and grows through its
  stages over time while the wave runs.
- A flower that is sold or trampled stays gone for the rest of the wave — no
  regrowth mid-wave. This prevents farming one bed while ignoring the beds
  unicorns are close to.
- At the next wave start all flowers come back at stage 0 and grow again.
- Before a new wave comes in, surviving flowers should "die" back, probably
  with some animation, matching the reset above.
