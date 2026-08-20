# 066 — Stack-capability machinery; the polyfill converges with native, not widens

**Date:** 2026-07-10

**Context.** #033 set the polyfill's acceptance line by _widening_: `isGenericError`
admitted `Object.create(Error.prototype)` grafts and ES3-style classical-inheritance
errors that lack the `[[ErrorData]]` slot but whose prototype walks like an `Error`
prototype, preserving the equip-js shipped acceptance set. `Error.isError` reads
`[[ErrorData]]`, which is unobservable from userland, so a polyfill must approximate it —
and #033 chose the widest defensible approximation (tag + prototype-shape), diverging from
the native verdict even in modern engines. The redesign (#065) revisited the
approximation. The user pulled directly on the polyfill's dependence on the non-standard
`stack` property, which forced the question: what is the closest _reachable_ proxy for
`[[ErrorData]]`, and should the polyfill converge on the native verdict rather than widen
past it?

**Decision.** Approximate `[[ErrorData]]` through the observable side effect of
construction — a reachable `stack` — and **converge** with native rather than widen. Four
pieces of module-load machinery:

1. `ERROR_STACK_CAPABLE` — a `boolean` probed once at load by throwing a
   captured-constructor `Error`, catching it, and testing whether the caught value carries
   a string `stack`. Answers "does this environment populate stacks at all?" (throw is
   deliberate — some engines populate `stack` only on an actually-thrown error).
2. `retrieveErrorStack` — a reader whose access strategy is fixed once at load from how
   the realm's `Error.prototype` exposes `stack`: `gated-slot` (an accessor — invoke the
   captured getter with the value as receiver, reading the internal side effect through
   any chain) or `plain-data` (a data property — read directly and type-check). Both
   throw-safe → `undefined`. The mode is surfaced as `errorStackMode`.
3. `doesPassErrorGraftFilter(value)` =
   `!ERROR_STACK_CAPABLE || hasReachableErrorStack(value)` — the graft filter, **gated**
   by the capability probe. Where the environment guarantees stacks a value passes only if
   it carries a reachable one; where it does not, the filter stands down (every value
   passes — a missing `stack` proves nothing there). The `||` short-circuit means
   `retrieveErrorStack` fires _only_ where its answer is meaningful.
4. `doesImplementGenericErrorContract` =
   `doesPassErrorGraftFilter && doesImplementMinimumErrorContract`, graft-filter FIRST — a
   grafted shell is rejected before its coincidental `name` / `message` strings are read.

The net verdict: `isError(Object.create(Error.prototype))` is **`false` in a stack-capable
engine** — native rejects on the absent slot, the polyfill rejects on the absent `stack` —
the two **converging**. Only where the environment populates no stacks does the filter
stand down and the polyfill widen (admitting a graft native would reject).

**Rationale.** A reachable `stack` is the closest userland-observable proxy for the
unobservable `[[ErrorData]]`: a genuine error ran a constructor and (in a stack-capable
engine) carries one; an `Object.create(Error.prototype)` shell never ran the constructor
and does not. Gating the filter on `ERROR_STACK_CAPABLE` is what keeps it honest — firing
it where a missing `stack` proves nothing would manufacture false negatives. The old
widening (#033) admitted the graft _unconditionally_, diverging from native even in the
modern engines that dominate production; converging is the more faithful polyfill. The
accepted cost — a heavier module load and a dependence on the non-standard `stack` — is
confined by the gate to the environments where the signal is real, and `errorStackMode` /
`ERROR_STACK_CAPABLE` are exported `@internal` so the behavior is inspectable and
testable.

**Consequences.** Reverses #033's widening posture: the polyfill now converges on the
native `[[ErrorData]]` verdict wherever stacks are guaranteed. The old `.d.ts` "widening
superset" framing and the `// true (polyfill widens)` example were removed as now-false;
the `isError` / `isAnyError` docs name the two regimes (converge in stack-capable engines,
widen only where stacks are absent). The `DOMException` arm deliberately does NOT route
through the stack filter — its discriminator is the getter shape of `name` / `message`
(#068), which is engine-independent — so a valid but stackless `DOMException` (a browser
`DOMException`, which carries no `stack`) stays admitted by `isError`. The
`isGenericError` fast path applies the generic contract only after excluding
`DOMException` by identity (#069), so the stack filter never decides a `DOMException`
verdict.

**Supersedes #033** (polyfill widening); #033 stands as the historical record of the
retired widening posture and its equip-js-compatibility rationale. Builds on #032
(native-or-polyfill capture, retained), #065 (the realm-partition redesign this machinery
serves).
