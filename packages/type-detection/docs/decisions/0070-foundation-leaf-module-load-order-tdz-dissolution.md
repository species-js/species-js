# 070 — `foundation` leaf module: `TRUSTED_DATA_CONFIRMATION` extracted to dissolve the load-order TDZ on direct subpath entry

**Date:** 2026-07-16

**Deletability prediction corrected by #083 (2026-07-30).** The closing aside under
"Decision" below — that once the entry-point arena and the leaf-purity rule are both in
place, the hand-tuned barrel-order comment at `index.js` "becomes deletable" — is
**wrong**. #083 established that the barrel re-export order stays load-bearing through the
`function ↔ utility` eval-time cycle (vite-enforced), which is independent of the
subpath-entry TDZ this decision dissolved. Everything else here **stands**: the
`foundation` leaf, the entry-point arena, and the leaf-purity rule are unaffected.

**Byte-identical-surface clause amended by #084 (2026-08-05).** The Decision below keeps
`utility` re-exporting `TRUSTED_DATA_CONFIRMATION` so "the public surface stays
byte-identical". That clause was migration safety for a refactor which has since landed
and is now guarded directly by the entry-point arena; meanwhile the re-export turned out
to be the sentinel's ONLY path onto the package's typed surface while having no consumer
at all (every reader takes it from `#foundation` directly, as this decision itself
requires). #084 removes it. Everything else here **stands** — the `foundation` leaf, the
direct-import requirement, and the arena guard are unaffected.

**Context.** An outside review (fed the package as a ZIP) surfaced a defect the internal
verification never saw, and a throwaway reproduction (2026-07-16) confirmed it: **loading
a published subpath as its own entry point can crash at module-load time.** Entering
`@/utility` directly throws
`ReferenceError: Cannot access 'TRUSTED_DATA_CONFIRMATION' before initialization`. The
chain is a captured-intrinsic constant at module scope — `function.js` initializes
`AsyncFunctionConstructor = getDefinedConstructor(async () => …)` at load time
(`function.js`, Async Function Family section); `getDefinedConstructor` (in `@/utility`)
reads `TRUSTED_DATA_CONFIRMATION`; and on `@/utility` entry the load order is
`utility → config → function`, so `function`'s body executes while `utility` is still
mid-import and the constant (defined further down in `utility`) is in its temporal dead
zone. `getDefinedConstructor` is a hoisted `function` declaration, so the _call_ succeeds
mid-cycle; the hoisting doctrine protects the binding but not the free `const` its body
reads.

The blindness is a **delivery-seam** blindness: every test and every internal import
enters through the `@/index.js` barrel, whose re-export order (`@/function` first) is
hand-tuned and load-bearing — documented at `index.js` — so no code path inside the system
ever loaded a subpath as its own entry. Two scoping facts from the reproduction bound the
severity: the **barrel** entry loads clean (its order saves it), and **every built `dist/`
subpath** loads clean (the bundler flattens the `config ↔ function` / `utility ↔ function`
cycles into shared chunks). The crash therefore reaches source-level / raw-ESM entry only
— but the underlying fragility is an **unenforced invariant**: the working import graph is
a cycle balanced by one hand-tuned order, with no mechanical guard.

**Decision.** Extract `TRUSTED_DATA_CONFIRMATION` into a new **zero-internal-import
leaf**, `src/foundation/index.{js,d.ts}`. Every internal consumer — `function`, `evented`,
`thenable`, `object`, `error` — imports it **directly** from `@/foundation`; `utility`
imports it from `@/foundation` for its own descriptor-walk uses **and re-exports it** so
the public surface stays byte-identical (`TRUSTED_DATA_CONFIRMATION` remains reachable at
`@…/utility` and through the barrel). `foundation` is **not** a published subpath — the
bundler inlines it, and the public API is unchanged. `function` importing from
`@/foundation` directly is **load-bearing, not cosmetic**: a re-export-only routing
through `@/utility` would leave the crash intact, because on `@/utility` entry `utility`'s
own `@/foundation` import has not evaluated when `function`'s body runs.

**Rationale.** A leaf with zero internal imports is, by ES-module post-order evaluation,
fully initialized before any module that imports it. Making `foundation` a direct
dependency of every module that reads `TRUSTED_DATA_CONFIRMATION` therefore guarantees the
constant is initialized before any hoisted helper reads it, regardless of which subpath is
entered first. This is the **extract-the-shared-leaf** cycle dissolution — it changes
structure honestly, rather than the two alternatives (dependency-inversion by passing the
value as a parameter; lazy access at call time), both of which _hide_ the coupling rather
than remove it and were rejected for a hack-free first release. The constant is a pure
`true` sentinel with no dependencies of its own (the flag that threads a trusted-data hint
through the descriptor walk to skip `isValidPropertyKey`, #058), so it is the cleanest
possible leaf tenant.

**Scope boundary.** This dissolves the **crash**, not the **cycle**. The
`config ↔ function` (module-scope `isCallable` gate) and `utility ↔ function`
(`getDefinedConstructor`) edges remain — they do not crash, because the only TDZ-sensitive
module-scope read across the cycle was this one constant. A strict global `no-cycle` rule
is therefore deliberately **not** adopted here (it would require sinking the floor
predicates `isCallable` / `isFunction` / `isNewableFunction` into the leaf and
re-exporting them from `function`, which this decision declines in order to keep
`function`'s definitions in place). The surviving cycle is instead guarded by two
mechanical checks: the **fifth-axis entry-point arena** (load every subpath as its own
entry, assert none throw — the guard that tests the real property directly) and a
**leaf-purity rule** (`foundation` imports nothing). The entry-point arena ships with this
decision (`test/entry-arena.test.js`); the leaf-purity rule is still pending. Once both
are in place, the hand-tuned barrel-order comment at `index.js` becomes deletable.

**Consequences.** Verified empirically before adoption via a throwaway scratchpad mirror
of `src/` plus an `@/`-resolving ESM loader arena: all eight subpaths + the barrel + the
new leaf load clean as their own entry (previously `@/utility` threw); behavior intact —
`TRUSTED_DATA_CONFIRMATION` identity consistent across the leaf and `utility`'s re-export
(both `=== true`), `getDefinedConstructor` still resolves `Map` and `AsyncFunction` (the
exact module-scope path that was crashing), `isCallable` / `isFunction` unaffected.
`function` and `primitive` definitions are untouched; the public surface is
byte-identical. The `TRUSTED_DATA_CONFIRMATION_FLAG` typedef stays in `utility` (its only
consumer), repointed to `import('@/foundation')`.

First decision of the **delivery-seam cluster**, and it lands the fifth axis's entry-point
arena (`test/entry-arena.test.js`) as its permanent guard — every published subpath,
derived from `package.json` `exports`, loaded as its own entry in a fresh Node process;
the assertion is negative-control-proven to catch the reverted crash. The remaining
follow-on is its own ADR: the `@/` → Node `#`-subpath-imports migration (shipped `.d.ts`
currently emit unresolvable `@/` specifiers at a consumer's compiler), which also carries
the fifth axis's consumer-side type-resolution check. Builds on #058 (the
`TRUSTED_DATA_CONFIRMATION` hot-path-skip flag) and #060 (the sibling
`INSTANCE_LESS_CONSTRUCTOR = null` module-scope sentinel precedent).
