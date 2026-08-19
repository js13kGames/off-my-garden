# Set up the project from the TurboToot foundation

Bootstrap this repo by reusing the game-agnostic foundation commits from
`../TurboToot` (cherry-pick via a local remote, or copy the files):

- `4bbaf1c` 001: TypeScript + Vite 7 + `vite-plugin-singlefile` + advzip pipeline,
  Biome, strict tsconfig, full-window canvas.
- `54cb099` 002: canvas setup and fixed-step main loop.
- `eb56c5d` 003: basic game states and start interaction (also brings AGENTS.md).

Rename Turbo Toot references to "Unicorns Off My Lawn!". Drop TurboToot's ticket
files if they come along with the commits.

## Acceptance criteria

- `pnpm build` produces a single `dist/index.html` and reports the zipped size.
- Opening the dev server shows the canvas with the start interaction working.
- `pnpm lint` (Biome) passes.
