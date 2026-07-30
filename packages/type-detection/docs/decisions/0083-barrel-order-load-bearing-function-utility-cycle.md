# 083 — Barrel re-export order stays load-bearing: the `function ↔ utility` eval-time cycle (corrects #070's deletability prediction)

**Date:** 2026-07-30

**Context.** ADR #070 (foundation leaf) predicted, at line 65, that once the load-order
decoupling was in place the "hand-tuned barrel-order comment at `index.js` becomes
deletable." #075 then made `config` a runtime leaf (inlining `isCallable`), dissolving the
`config ↔ function` cycle the `src/index.js` comment cited. A 2026-07-30 investigation set
out to execute that deletion — de-pin the barrel order — and found the prediction
**premature**: a _distinct_ eval-time cycle remains that #075 never addressed.

`function.js` builds `AsyncFunctionConstructor` **at module-load**:

```js
const AsyncFunctionConstructor = /** @type {NewableFunction} */ (
  getDefinedConstructor(async () => PromiseConstructor?.resolve() ?? null)
);
```

`getDefinedConstructor` is imported from `#utility`, and it reads `#function`'s
`isCallable` — so `#function`'s own evaluation calls into `#utility`, which depends back
on `#function`: a `function ↔ utility` cycle exercised at evaluation time (not deferred
into a predicate body). If `#utility` (or the interdependent `#primitive` / `#object`)
evaluates first, that capture fires while a binding is still in its temporal dead zone.

**A measurement caution worth recording.** The investigation first concluded the order was
_free_ — 11 barrel permutations all loaded clean. That test used **native Node ESM**
(`node --input-type=module`), which tolerates this cycle. The shipped/tested artifact runs
under **vite's transform** (vitest and the browser build), which does **not** tolerate it:
the wrong order throws `ReferenceError: Cannot access '…' before initialization`. The
false "order is free" conclusion came entirely from testing the wrong loader. **Load-order
claims must be verified under vite (the actual toolchain), never native Node.**

**Decision.**

1. **Keep the coupling; adopt the simple rule "`#function` first."** `#function` must be
   re-exported **first**. Empirically (under vite, cache-cleared) that is sufficient for
   total freedom of the rest: `#function`-first forces the interdependent cluster
   (`function` / `utility` / `primitive` / `object`) to evaluate fully before any later
   barrel line, so the **remaining seven modules may be ordered freely** for readability /
   aesthetics. (The strictly-minimal constraint is weaker — `#function` merely before
   `#utility` / `#primitive` / `#object`, with leaves free to precede it — but
   `#function`-first is the adopted convention: it is the simplest true statement and it
   frees everything else.)
2. **Reject the lazy-evaluation alternative.** The order could be freed by deferring the
   `AsyncFunctionConstructor` capture (memoize on first use) or inlining the sliver of
   `getDefinedConstructor` that `#function` needs (the move #075 made for `config`'s
   `isCallable`). This is declined **by owner decision**: lazy evaluation trades one
   local, visible, test-guarded constraint for "is it initialized yet?" indirection
   scattered across call sites — it hides the coupling rather than naming it. A single
   documented load-order edge between two modules is the simpler complexity to carry.
3. **The barrel-order comment stays — corrected, not deleted.** It now cites the real
   `function ↔ utility` cause (the AsyncFunctionConstructor capture) rather than the
   dissolved `config ↔ function` one, and names the vite-vs-native distinction. #070's
   "becomes deletable" prediction is **superseded**: not because the decoupling is
   infeasible, but because it is deliberately not taken.
4. **`test/index.test.js` is the guard.** It loads the barrel under vitest and fails on
   any order that evaluates a cluster member before `#function`.

**Rationale.**

- **Visible-local beats invisible-global complexity.** The coupling is one line
  (`function.js`'s load-time capture) and one ordering rule, both documented and
  test-enforced. Lazy evaluation would spread initialization-order reasoning into every
  consumer of `AsyncFunctionConstructor` and every future maintainer's mental model —
  strictly more surface for strictly less clarity.
- **The constraint is real, not superstition.** It was empirically characterized under the
  actual transform: `#function` before `#utility` passes; `#utility` (or `#object`) before
  `#function` throws the TDZ. So the rule is kept because it is _true_, and it is now
  documented with its _real_ cause so no one deletes it believing #070's obsolete premise.
- **No runtime or behavior change.** This records mechanics and a decision; the shipped
  order is unchanged.

**Consequences.**

- `src/index.{js,d.ts}` barrel comments corrected to the `function ↔ utility` cause + the
  vite/native distinction + the `index.test.js` guard reference.
- `test/entry-arena.test.js` gains a cross-ref: its "load-bearing order" mention now
  points here (its own subject — the #070 subpath-entry / `TRUSTED_DATA_CONFIRMATION` seam
  — is distinct and still fixed by the foundation leaf).
- **Distinct from #070 and #075, both of which stand.** #070 fixed the _subpath-entry_ TDZ
  via the foundation leaf (a different cycle: `TRUSTED_DATA_CONFIRMATION`); #075 dissolved
  `config ↔ function`. This ADR governs the _barrel-order_ load-bearingness, whose live
  cause is `function ↔ utility`. Only #070's forward-looking "comment becomes deletable"
  aside is corrected.
- **Toolchain lesson (forward-applicable):** any future load-order / TDZ claim is verified
  under vite, and if a native-Node check disagrees, vite wins for the shipped artifact.
- Within the one rule (`#function` first), the barrel order is a free maintainability /
  aesthetic preference — the other seven modules may be arranged however reads best
  (verified under vite across shuffled `#function`-first orders). The shipped order places
  `#function` first, then the remaining seven per the owner's aesthetic choice.
