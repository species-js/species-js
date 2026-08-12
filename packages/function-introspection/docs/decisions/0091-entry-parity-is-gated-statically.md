# 091 — Entry parity is gated statically, not by checking files exist

**Date:** 2026-08-12

**Context.** Curating this package's public entry (#085's schema, adopted here on
2026-08-12) added four `exports` subpaths and moved the root from `src/index.js` to
`src/public.js`. Three defects came with it, all found by hand:

- `./utility`, `./arrow` and `./concise` had no `lib.entry`, so each resolved to a file
  the build never emitted;
- `main`, `module`, `unpkg` and `jsdelivr` still named `index.*`;
- `types` pointed at `./src/index.d.ts` — the internal barrel — while the bundle was built
  from `src/public.js`.

None was visible to `tsc`: `exports[…].types` resolves from `src/`, which is always
present, while `import`/`require` resolve into `dist/`, which no type-check produces. The
first two would have failed at a consumer's `import`. `publint` caught the legacy fields
but not the `types` one, because the file it named does exist. `emptyOutDir: false`
compounds all of it — a stale `dist/` keeps answering after an entry is renamed.

**Decision.** `entries:check` (`scripts/check-entry-parity.mjs`) asserts parity between
each package's `exports` map, its legacy entry fields and its vite `lib.entry` — both
directions, plus the ADR #089 workspace-dependency pair. It runs in `check` and in CI,
beside `surface:check`.

**Rationale.**

- **Parity, never file existence.** "Does every target exist on disk" needs a build to
  mean anything and passes trivially in a fresh checkout — the empty-denominator shape
  this workspace has cleaned out before. Parity is decidable from two text files, so the
  gate runs in the inner loop. Artifact existence stays in `check:publish`, after a build.
- **Evaluate the config, do not parse it.** Each `vite.config.js` is imported once per
  `SPECIES_BUILD_TARGET`, and emitted filenames are derived by calling the config's own
  `lib.fileName()`. The gate learns the naming convention instead of restating it, so a
  change to `fileName` cannot desynchronize the check from the build.
- **Name no path.** `public`, `index`, `dist` and the extensions appear nowhere as
  constants. Both package shapes in the workspace — the curated `src/public.{js,d.ts}`
  root and the plain `src/index.js` one — satisfy the same rules, and a package moving
  between them stays green untouched.
- **Execute the alias regex, do not read it.** #089's alias must accept the bare specifier
  and refuse its subpaths. The gate asserts that by running the pattern against both,
  which a source-text comparison could only approximate.

**Alternatives.** Leaving it to `check:publish` was the status quo, and it is what missed
the `types` defect; it also runs only after a build, far from the edit. Generating
`exports` from the vite config (or the reverse) would remove the duplication outright
rather than guard it — better, and recorded as this script's TRIP CONDITION, but a larger
change than the defect warranted today.

**Consequences.** One more static gate in `check`, ~0.4 s. It is a guard over a hand-kept
duplication and must be **deleted**, not maintained, if a shared vite factory ever derives
one side from the other. Verified by mutation: each of the three historical defects plus
seven neighboring ones was reintroduced, confirmed to have landed on disk, and caught with
the expected message — 10/10, and green again on restore.
