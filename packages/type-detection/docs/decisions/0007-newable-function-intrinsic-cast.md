# 007 — Intrinsic constructor capture cast type: `NewableFunction`

**Date:** 2026-06-01

**Context.** The orchestrators capture each non-newable intrinsic at module-load via
`getDefinedConstructor(<sample-value>)` — e.g.
`const AsyncFunctionConstructor = /** @type {NewableFunction} */ (getDefinedConstructor(async () => Promise.resolve()))`.
The cast type was inconsistently `Function` or `unknown` in earlier drafts.

**Decision.** Cast every captured intrinsic to `NewableFunction`.

**Rationale.** `%AsyncFunction%`, `%GeneratorFunction%`, and `%AsyncGeneratorFunction%`
are themselves newable — `new AsyncFunction('async function body')` creates an async
function at runtime, and the same for the other two. `NewableFunction` is the lenient base
from decision #003 and accurately captures the constructor surface. The cast lets
`value instanceof AsyncFunctionConstructor` typecheck cleanly because `NewableFunction`
has the right call shape on its right-hand side.

**Consequences.** Applied uniformly across `AsyncFunctionConstructor`,
`GeneratorFunctionConstructor`, `AsyncGeneratorFunctionConstructor`.
