# Add calm and nervous unicorn moods

Introduce the mood dimension: some unicorns spawn nervous.

- Calm: normal walk speed, NOTICE pause ~700 ms.
- Nervous: faster movement, NOTICE pause ~250 ms — mood shortens the player's
  reaction window, not just travel time.
- Nervous unicorns are visually distinct: agitated eyes / jittery motion.
- Mood constants live next to the other tuning constants.

## Acceptance criteria

- Both moods appear over time and are visually distinguishable at phone scale.
- A nervous unicorn commits to a noticed flower noticeably faster than a calm one.
