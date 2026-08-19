# Agent rules

## Comments are free — preserve them

The 13 kB budget applies to the bundle, not source. `terser` strips
them at build time, so they cost zero bytes in `dist/`. Don't remove
existing comments during refactors; update them if stale.

## Style discipline

- Biome governs style (`pnpm lint`). Do not bypass its rules in source.
- prefer `const enum` string unions: it erases entirely and saves bundle size
  while keeping expressiveness.
