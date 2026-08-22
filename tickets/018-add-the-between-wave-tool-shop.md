# Add the between-wave tool shop

After each wave, buy tool stock with coins before the next wave starts.

- When the last unicorn leaves and the flowers reset, an overlay opens over the
  frozen garden showing the three tools with their price and owned stock.
- Tapping a tool buys one unit: coins decrease, stock increases. Repeatable as
  long as the player can afford it — no purchase cap, stock carries over.
- Prices are fixed per tool (tuning constants next to the others); tune during
  playtesting against flower income.
- A prominent button closes the overlay and launches the next wave; buying
  nothing is allowed.
- Wave 1 starts with zero tools: the leprechaun keeping unicorns at a distance
  is the free defense until the first shop. Remove any temporary dev stock
  granted earlier for testing.

## Acceptance criteria

- After every wave the shop appears; buying deducts coins and raises the badge
  counts immediately.
- Purchases that would go below zero coins are visually disabled.
- Starting the next wave resumes spawning with the new stock in place.
