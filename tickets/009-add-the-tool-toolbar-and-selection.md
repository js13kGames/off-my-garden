# Add the tool toolbar and selection

Add the bottom toolbar with the three tools: 🔊 noise, ☘️ repel, 🌈 attract.

- Tap a tool (or press `1`/`2`/`3`) to select it; the selected tool gets a simple
  rectangular highlight. Tapping the selected tool deselects it.
- With no tool selected, ground taps move the leprechaun and flower taps sell
  (existing behavior). With a tool selected, the next playfield tap is the tool's
  target (behavior implemented in the following tickets).
- Tools are free to use in the POC — no costs.

## Acceptance criteria

- The three tools render in the bottom strip; selection works by tap and by keys
  1/2/3 with a visible highlight.
- Selecting a tool changes what the next playfield tap does; deselecting restores
  move/sell behavior.
