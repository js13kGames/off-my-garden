# Add the NOTICE state and flower targeting

Give unicorns the design's core telegraph: while wandering, a unicorn that comes
near a bed with growing flowers may notice one.

- On notice: the unicorn STOPS for ~0.5–0.8 s, shows a thought bubble with the
  flower, then turns and walks toward it.
- The pause duration is a tunable constant — it is the player's reaction window.
- Notice chance/radius tuned so unicorns still spend most of their time walking
  harmlessly between beds.

## Acceptance criteria

- A wandering unicorn near a bed sometimes stops, shows a thought bubble, then
  walks toward the noticed flower.
- The pause is clearly readable at phone scale before the unicorn commits.
