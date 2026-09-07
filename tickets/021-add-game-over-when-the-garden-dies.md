# Add game over when the garden dies

The garden is the run: when the last flower goes, the game ends immediately.

- If every flower across all beds is gone — none alive or growing — trigger
  game over right away, no waiting for the wave to end.
- Show a simple overlay: waves survived and coins earned, tap to restart from
  wave 1 with zero tools and a fresh garden.

## Acceptance criteria

- Emptying the garden triggers the game-over overlay instantly with the score.
- Restarting resets coins, wave counter, and beds cleanly.
