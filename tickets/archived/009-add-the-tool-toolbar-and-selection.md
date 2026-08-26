# Add the tool toolbar and selection

Add the bottom toolbar with the three tools: 🔊 noise, ☘️ repel, 🌈 attract.

- Tap a tool (or press `1`/`2`/`3`) to select it; the selected tool gets a simple
  rectangular highlight. Tapping the selected tool deselects it.
- With no tool selected, ground taps move the leprechaun and flower taps sell
  (existing behavior). With a tool selected, the next playfield tap is the tool's
  target (behavior implemented in the following tickets).
- Each tool shows its stock count as a small badge on its button. A tool with
  zero stock renders grayed out and cannot be selected; using a tool consumes
  one unit of stock.
- Stock is bought between waves in the shop ticket. Until that exists, start
  with a temporary dev stock of a few units per tool so the tools are testable.

## Acceptance criteria

- The three tools render in the bottom strip with stock badges; selection works
  by tap and by keys 1/2/3 with a visible highlight.
- Selecting a tool changes what the next playfield tap does; deselecting restores
  move/sell behavior.
- A zero-stock tool is grayed out and rejects selection.
