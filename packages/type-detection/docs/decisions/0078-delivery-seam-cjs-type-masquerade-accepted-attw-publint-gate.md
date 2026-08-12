# 078 — Delivery-seam F3: CJS type-masquerade accepted; `attw` + `publint` gate; `node10` dropped

**Date:** 2026-07-27

> **AMENDED 2026-08-12.** The contributor floor is now `>=22`, not `>=22.22.1`. The patch
> level was never justified anywhere and `.npmrc`'s `engine-strict=true` made it a HARD
> block, so a contributor on any earlier 22.x patch could not install. The two-floor
> design below is unchanged, and the consumer floor is now guarded: `smoke:check` scans
> the built output for post-ES2020 syntax, since the `node22` build target permits
> emitting it.

**Context.** The delivery-seam cluster (#070 runtime load-order, #071 consumer-deliverable
types) closed the two seams that "shipped in theory," each turned into a guarded property:
`entry-arena.test.js` (runtime) and `consumer-resolution.test.js` (types). But
`consumer-resolution.test.js` validates a _single_ mode — it compiles the shipped `.d.ts`
**by path** under `moduleResolution: bundler`, proving the declarations are internally
consistent and their `#`-subpath imports resolve. It does **not** exercise how a bare
`import … from '@species-js/type-detection'` resolves _through the `exports` map_ across
the other module modes. Running the two standard publish-validators against the packed
tarball —
[`@arethetypeswrong/cli`](https://github.com/arethetypeswrong/arethetypeswrong.github.io)
and [`publint`](https://publint.dev) — surfaced the blind spot as a **third delivery-seam
finding (F3)**:

- **`FalseESM` (×9, one per entrypoint)** — the single ESM `types` condition
  (`./src/*.d.ts` in a `"type": "module"` package) is served to the `require` condition
  too, so a CJS consumer resolves ESM-shaped types against a CJS runtime — attw's
  "masquerading as ESM." `publint` flags the same: _"types is interpreted as ESM when
  resolving with the `require` condition."_
- **`NoResolution` + `InternalResolutionError` (×8 each)** — legacy
  `moduleResolution: node` (node10, classic) can't follow the `exports` map or the
  `#`-subpath imports → no types.

Separately, the run caught a real defect the same instant it ran: a mis-added public
`"./foundation"` `exports` entry (an uncommitted module-order experiment that
overreached), pointing at `dist/*/foundation.*` files that don't exist. `foundation` is
the **internal** load-order leaf (#070) whose only export is the
`TRUSTED_DATA_CONFIRMATION` hot-path sentinel (#058) — never a consumer surface. Reverted
(details below).

**Decision.**

1. **Accept the CJS type-masquerade — do not ship `.d.cts` twins.** The package ships one
   hand-written ESM `.d.ts` per module, served to all conditions including `require`. A
   "proper" fix would require a `.d.cts` twin **for every module** _and_ a
   **condition-split `imports` map** — because the barrel `.d.ts` re-export the sibling
   modules through `#`-subpath imports, so each twin would otherwise cascade back to an
   ESM `.d.ts`. That is real structural complexity ("configuration hell") for near-zero
   benefit: the public surface is **named-exports-only, no default export**, so the ESM
   declarations are shape-compatible with the CJS named-export runtime under
   `esModuleInterop`. Modern consumers (`bundler`, `node16`-from-ESM) get clean types; CJS
   consumers get benign shared types. If a default export is ever added, this is revisited
   (the masquerade would stop being benign).

2. **Drop `node10` support** (`moduleResolution: node`, classic). A new ES2020,
   `"type": "module"` foundation package does not owe the deprecated resolution mode.

3. **Gate the full seam** with `@arethetypeswrong/cli` + `publint` (dev deps) and a
   `check:publish` script —
   `attw --pack --ignore-rules false-esm no-resolution internal-resolution-error` then
   `publint --level error` — wired into `check:full`. The three ignored attw rules are
   **exactly** the two accepted trades (CJS-masquerade + node10-drop); the gate is green
   on the accepted state and **red on any new regression**. It closes
   `consumer-resolution.test.js`'s bundler-only blind spot, and proved itself by catching
   the `./foundation` overreach on first run.

4. **Package hygiene** (`publint` suggestions), across all four packages:
   `engines.node: ">=18"` — the **consumer** support floor (the ES2020 API-floor design
   keeps the code runnable there; the root `engines` stays `>=22.22.1` as the
   **contributor** floor) — and `repository.url` gains the `git+` prefix.

**Rationale.**

- **The masquerade is benign for this surface.** Named exports, no default → the one ESM
  `.d.ts` describes the CJS runtime correctly under `esModuleInterop`. The disproportion
  between the fix (dual declarations + condition-split imports across every module) and
  the benefit (silencing one advisory for a shape that already works) makes
  _accept-and-document_ the correct engineering call, not a compromise.
- **The gate is the real deliverable.** F1/F2 were caught late because no check stood in a
  consumer's position across modes; `consumer-resolution.test.js` only ever saw `bundler`.
  `attw` + `publint` are the tools that resolve the tarball _as each TS mode would_ — the
  guard the seam was missing.
- **node10 is deprecated;** modern TS uses `bundler` / `nodenext`.

**Consequences.**

- CJS consumers receive the shared ESM types (benign masquerade); documented here and in
  the `delivery-seam-defects` memory. `attw` reports three accepted problem-kinds
  (`false-esm`, `no-resolution`, `internal-resolution-error`) — the gate ignores exactly
  those and fails on anything else.
- The `./foundation` public export was removed from `package.json`, both
  `src/index.{js,d.ts}` barrels (`export * from '#foundation'`), and the `vite.config.js`
  build entry. `foundation` stays `#foundation` in the `imports` map — internal only, its
  role since #070. The rest of the same experiment — reordering the barrel `export *` list
  (moving `#function` off first, `#object` ahead of `#primitive`) — was **also reverted**:
  the barrel's runtime `export *` order is **load-bearing** (`#function` must load first
  so the `config ↔ function` cycle resolves through `function`'s hoisted `isCallable`, per
  #070), and the reorder crashed `index.test.js` with an `import before initialization`
  TDZ. A different order is possible but is a deliberate load-order exercise, guarded by
  `index.test.js` + `entry-arena.test.js`.
- `check:full` now runs the publish gate after `build` + `pack:check`; `check:publish` is
  also runnable standalone (attw `--pack` self-builds, then publint sees the fresh
  `dist`).
- Extends the #070 / #071 delivery-seam cluster; supersedes nothing.
