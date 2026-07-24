# 075 — `config` becomes a true runtime leaf: decouple its last internal import

**Date:** 2026-07-24

**Context.** After #074 relocated the Number predicates, `config`'s **only** remaining
internal runtime import is `isCallable` from `#function` — a single use, the
`objectHasOwn` native-vs-polyfill gate:

```js
export const objectHasOwn = isCallable(nativeHasOwn) ? nativeHasOwn : hasOwn;
```

That import is also the surviving edge of the `config ↔ function` load cycle:
`config → function` (this `isCallable` import) and `function → config` (`function` imports
`toFunctionString`). It is the last cycle `config` still participates in.

Two facts make the import removable without loss:

1. **`isCallable` is a bare operator wrapper**, not a safety capture — its whole body is
   `return typeof value === 'function'`. The codebase's "always reach through the captured
   helper" rule exists for **tamperable intrinsic methods** (`Object.hasOwn` → the cached
   `hasOwn.call`), because a method reference can be swapped per-realm. `typeof` is an
   **operator** — there is nothing to capture and nothing to tamper. So `isCallable` is a
   readability alias here, not a cross-realm safeguard.
2. **The consequence is load-order leverage.** #074 had to leave `primitive` reading its
   Number intrinsics from `globalThis` **directly** — a workaround — because `config` was
   still in the cycle, and an eval-time read of `config`'s `globalContext` TDZ-crashed on
   a `./config` entry (caught by `entry-arena.test.js`). Removing `config`'s last runtime
   import dissolves that constraint at the root.

**Decision.**

1. **Inline the single use.** Replace `isCallable(nativeHasOwn)` with the raw
   `typeof nativeHasOwn === 'function'` and drop `import { isCallable } from '#function'`
   from `config/index.js`.
2. **Keep `config/index.d.ts`'s `type`-only imports** (`Callable`, `NewableFunction` from
   `#function`; `DictionaryObject` from `#object`). They are runtime-erased, create no
   load edge, and reference legitimately-shared domain types — duplicating them would be a
   downgrade for zero runtime benefit. The decoupling is a **runtime-import** decoupling
   only.
3. **Result:** `config/index.js` has **zero runtime imports of any kind** — `config` is a
   true runtime leaf, alongside `#foundation` (#070).

**Rationale.**

- **The `config ↔ function` cycle is dissolved.** Removing `config → function` (its last
  runtime edge) leaves `config` importing nothing internal. A module with no outgoing edge
  can never be re-entered mid-cycle, so its body **always fully evaluates before any
  importer's body runs**.
- **Eval-time reads of `config` exports are now safe everywhere.** Because `config` is a
  leaf, every export (`globalContext`, `objectIs`, `getPrototypeOf`, `objectPrototype`,
  `toFunctionString`, …) is guaranteed initialized at any consumer's **eval time**. This
  **retires #074's `globalThis` workaround**: `primitive` now reads `config`'s
  `globalContext` at eval time — the canonical single capture point, consistent with every
  other `globalContext.X` read in the codebase. Verified: `entry-arena.test.js` 10/10 with
  `primitive`'s eval-time `globalContext` read, full suite 717/717, `tsc` clean.
- **No safety loss from inlining `isCallable`.** It wraps an operator, not a tamperable
  method (see Context §1). The one call site is exercised by `objectHasOwn`'s own tests,
  and `typeof x === 'function'` is self-evidently correct; `isCallable` remains the
  exported, tested helper in `#function` for its real function-domain consumers.
- **The leaf invariant is guarded, not hoped.** `primitive`'s eval-time `globalContext`
  read is safe **only while `config` stays a leaf**. If `config` ever regains a runtime
  import that re-enters a cycle, an eval-time read of a `config` `const` TDZ-crashes on
  some entry point — and `entry-arena.test.js` catches it, exactly as it caught the
  original hazard. "`config` imports nothing at runtime" is therefore an **enforced**
  load-order invariant.

**Consequences.**

- `config/index.js`: zero runtime imports; `config` is a runtime leaf. **No load cycle can
  pass through `config` at all** — including the
  `config → function → utility → primitive → config` cycle that #074's direct-edge removal
  left intact **transitively** (the one `entry-arena.test.js` caught TDZ-crashing).
  `config ↔ function` was its last edge.
- `config/index.d.ts` is unchanged — `type`-only imports retained.
- **Amends #074:** its Decision §2 `globalThis`-direct capture and its "cycle-safe by
  discipline" rationale are superseded here — `primitive` reads `config`'s `globalContext`
  at eval time now that the hazard is removed rather than avoided.
- The invariant "`config` imports nothing at runtime" is now load-order-load-bearing and
  guarded by `entry-arena.test.js`. A future runtime import into `config` must either keep
  `config` acyclic or re-audit every eval-time `config`-export read (`primitive`'s
  `globalContext` among them).
- No public API or surface change — purely internal dependency-graph and implementation.
