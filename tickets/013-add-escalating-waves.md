# Add escalating waves

Give the session shape with discrete, escalating waves.

- A wave spawns a fixed roster of unicorns: roster size, spawn pacing,
  simultaneous cap, and nervous ratio are tuning constants that step up each
  wave. Show `Wave N` in the HUD while the wave runs.
- The wave ends when every unicorn it spawned has left the screen. Survivors
  don't carry over; the field is clear between waves.
- After the last unicorn leaves comes the intermission: flowers reset (see the
  plant-growth ticket) and the between-wave shop opens (its own ticket). Until
  the shop exists, a short calm pause leads straight into the next wave.
- No lose condition yet — waves escalate indefinitely and coins are the score.
  Leave a note in code for the candidate post-POC structures (money goal,
  rainbow power meter with celebration + best count, timed session) per the
  README.

## Acceptance criteria

- Waves come one at a time; the HUD counter increments only after the previous
  wave's unicorns are fully gone.
- Later waves visibly bring bigger rosters and more-nervous unicorns.
- The field is empty of unicorns between waves.
