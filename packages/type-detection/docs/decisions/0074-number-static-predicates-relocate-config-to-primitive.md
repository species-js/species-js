# 074 — Relocate the Number static-method predicates from `config` to `primitive`

**Date:** 2026-07-24

**Amended by #075 (2026-07-24).** Step §2's `globalThis`-direct capture and the
"cycle-safe by discipline" rationale were a workaround for `config` still being in the
load cycle. #075 removed `config`'s last runtime import, making it a true leaf — so
`primitive` now reads `config`'s `globalContext` at eval time (the canonical capture
point). The relocation record below stands; the two superseded passages are marked inline.

**Context.** Six exports live in `config/index.{js,d.ts}` under a "Number Static Methods"
section: the three public type-guards `isFiniteNumberValue` / `isIntegerValue` /
`isSafeIntegerValue` (realm-fixed `Number.isFinite` / `isInteger` / `isSafeInteger` with a
polyfill fallback, `.d.ts`-retyped to `(value: unknown) => value is number`) and their
three `@internal` polyfills `isFiniteNumber` / `isInteger` / `isSafeInteger`
(fallback-path unit-test hooks). They were introduced there by #026 (alongside the
`isValidPropertyKey` tightening) and refined by #072 (finite-number contract, superseding
#026's safe-integer rule). Three problems with that home:

1. **Wrong module by role.** These are Number-family runtime **type guards** — domain
   detection. `config`'s role is capability captures, cached prototypes, and
   boundary-retyping (infrastructure), not domain predicates. `primitive` is the module
   that owns primitive-type detection (String / Number / Boolean / Symbol / BigInt). The
   #026 placement was incidental, not principled.
2. **They form the `config → primitive` load-cycle edge.** The `isFiniteNumber` polyfill
   composes `isNumberValue` (a `primitive` function) with the captured global `isFinite`.
   That single use is the **only** reason `config` imports from `#primitive` — and it is
   the first edge of the documented `config → primitive → object → config` load cycle (the
   TDZ hazard family of #070).
3. **Consumer-facing surface, not internal.** Post-#072, `isValidPropertyKey` (in
   `utility`) uses only `isFiniteNumberValue`; `isIntegerValue` and `isSafeIntegerValue`
   have **no internal consumer** — they exist as a public Number type-guard family for
   downstream packages, whose natural home is the consumer-facing `primitive` surface.

**Decision.**

1. **Move all six exports** (the three predicates + their three `@internal` polyfills)
   into `primitive.{js,d.ts}`, as a "Number static-method predicates" subsection of the
   Number family. Behavior, signatures, `.d.ts` type-guard retyping, and the `@internal`
   tags on the polyfills are unchanged — a pure relocation.
2. **`primitive` re-captures its own realm-fixed intrinsics** — `Number`, `Math.abs`,
   `Math.floor`, `Number.MAX_SAFE_INTEGER`, and the global `isFinite`. _(Superseded by
   #075: at relocation these were read from `globalThis` **directly**, a workaround for
   `config` still being in the cycle; once #075 made `config` a leaf, `primitive` reads
   them from `config`'s `globalContext` at eval time — the canonical capture point.)_
   `primitive` imports `isCallable` from `#function` for the native-method selection. The
   `isFiniteNumber` polyfill uses `primitive`'s **own** `isNumberValue`, so no
   `#primitive` import is needed anywhere for it. `config`'s private captures move with
   the predicates; none were used elsewhere in `config`.
3. **`config` drops the six exports and its `#primitive` import.** Post-move `config`
   depends only on `#function`.
4. **Update the one consumer** — `utility/isValidPropertyKey` imports
   `isFiniteNumberValue` from `#primitive` instead of `#config` (`utility` already imports
   from `#primitive`).
5. **Public subpath home moves `/config` → `/primitive`** (`#config` → `#primitive`
   internally). Barrel importers (`@species-js/type-detection`) are unaffected; only a
   direct `…/config` subpath import of these symbols would change to `…/primitive`.

**Rationale.**

- **Semantic coherence.** A Number type guard belongs in the primitive-type-detection
  module. This puts the public Number-guard family on the correct consumer-facing surface
  and removes domain predicates from infrastructure `config`.
- **Removes `config`'s only DIRECT `#primitive` import — but does NOT dissolve the
  cycle.** `config`'s direct dependency list shrinks to just `#function`, a real
  simplification. The cycle itself persists **transitively**:
  `config → function → utility → primitive → config`, so `primitive` is still loaded
  mid-cycle (before `config`'s body runs) when `./config` is the entry point. An early
  draft mis-claimed the move made the graph acyclic; `entry-arena.test.js` disproved it (a
  direct `./config` entry TDZ-crashed on `globalContext` before this was corrected).
- **Cycle-safe by discipline (the source-side load-cycle rule).** _(Superseded by #075,
  which removed the hazard rather than disciplining around it; the lesson is retained.)_
  At relocation, `primitive` remained in the cycle, so it could not read a `config`
  `const` at **eval time** — an early draft that read `config`'s `globalContext`
  TDZ-crashed on a `./config` entry, caught by `entry-arena.test.js`. The workaround
  captured `Number` / `Math` / `isFinite` from `globalThis` directly (a global binding is
  always initialized; a `config` `const` export is not, when the cycle pulls `primitive`
  in before `config` initializes). `isCallable` was safe at eval time even then because it
  is a **hoisted `function` declaration** in `#function`, not a `const`. #075 subsequently
  made `config` a leaf, so the eval-time `globalContext` read is now safe — see #075 for
  the current mechanism and its guard.
- **Right moment.** `primitive` is the next test-round module; relocating the predicates
  as step one lets the round spec and test them as first-class primitive predicates.

**Consequences.**

- `config`'s export surface shrinks by six; `primitive`'s grows by six. `config` no longer
  imports `#primitive` — and #075 then removes its last runtime import (`#function`)
  entirely, making `config` a true leaf.
- Supersedes the **location** aspect of #026 (its "three new Number type-guards live in
  config" premise); the behavior and #072's finite-number contract are unchanged.
- `CONFIG.spec.md` loses the Number-static-methods section; `PRIMITIVE.spec.md` gains it;
  `UTILITY.spec.md`'s `isValidPropertyKey` attribution updates `#config` → `#primitive`.
- The three polyfills remain `@internal` (fallback-path unit-test hooks); whether the two
  internally-unused integer guards stay public or are pruned is left open (a separate
  surface decision — this ADR only relocates). _(Resolved 2026-07-27, owner ruling: all
  three guards stay **public** — downstream packages are the intended consumers; the three
  polyfills stay `@internal`. Recorded in `PRIMITIVE.spec.md` and
  `architecture/primitive.md`.)_
- Downstream consumers (none yet; species-js is pre-release) importing these from the
  `/config` subpath would move to `/primitive`.
