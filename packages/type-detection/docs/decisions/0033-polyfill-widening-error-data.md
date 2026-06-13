# 033 — Polyfill widening semantics over the unobservable `[[ErrorData]]` slot

**Date:** 2026-06-05

**Context.** ECMA-262 §20.5.2.2 `Error.isError(v)` returns `true` if `v` carries the
internal `[[ErrorData]]` slot. The slot is set by `OrdinaryCreateFromConstructor` inside
the `Error` constructor (and inherited by every built-in subclass — `TypeError`,
`SyntaxError`, etc. — plus user-defined `class X extends Error` instances) and by the
WebIDL `DOMException` spec. The slot is _unobservable_ from userland code; the spec
predicate cannot be implemented in pure JS without engine support. The polyfill body
`isGenericError` therefore has to approximate `[[ErrorData]]` with a structural heuristic.
The migration question was where to draw the polyfill's acceptance line.

**Decision.** The polyfill widens to admit values that lack `[[ErrorData]]` but match the
structural Error contract. `isGenericError(v)` accepts:

1. `v instanceof Error` (local realm — covers every `[[ErrorData]]`-bearing value in this
   realm).
2. `getTypeSignature(v) === '[object Error]'` (every realm's Error-tagged value;
   `Object.prototype.toString` returns `'[object Error]'` for any value carrying
   `[[ErrorData]]` per ECMA-262 §20.1.3.6 step 17, so this catches cross-realm Errors).
3. `getTypeSignature(v) === '[object DOMException]'` (WebIDL's separate tag).
4. `getTypeSignature(v) === '[object Object]'` AND `hasErrorPrototypeContract(v)` (the
   legacy widening — `Object.create(Error.prototype)` and ES3-style classical-inheritance
   Errors whose `[[Prototype]]` walks like an Error prototype but never went through the
   `Error` constructor and so lack `[[ErrorData]]`).

The first three cases align with the spec; the fourth widens beyond it.

**Rationale.** Two postures are defensible. _Spec-precise_ would reject the legacy cases
on the grounds that they lack the formal `[[ErrorData]]` invariant, accepting that
existing JS code relying on `Object.create(Error.prototype)` would silently lose
recognition. _Polyfill widening_ admits them on the grounds that the heuristic is the best
userland can do, and the equip-js source has shipped this acceptance set for years in
production downstream code. The species-js round preserves the equip-js admission set
because:

- The package is foundation-tier infrastructure. Six downstream packages (`cadence-js`,
  `equip-js`, `cambium-js`, `talented-js`, `modulate-js`, `inflect-js`) and their
  consumers may have code that constructs errors via `Object.create(Error.prototype)` or
  the ES3-classical pattern. Tightening to spec-precise would break recognition silently.
- The native path is spec-precise. When `Error.isError` is available, `isError` delegates
  to it — the polyfill widening only affects runtimes where the native method is missing.
  Modern production runtimes converge on the spec; legacy runtimes get the widened
  heuristic for backward compatibility.
- `isGenericError` is exported `@internal` _and_ documented as the polyfill body. A
  consumer who wants strict spec semantics reaches for the public `isError` (which
  delegates to native when available); a consumer who wants the widened polyfill semantics
  irrespective of runtime reaches for `isGenericError` explicitly.

**Consequences.** Values like `Object.create(Error.prototype)` and ES3-style
classical-inheritance Errors are admitted by `isGenericError` (and by `isError` in
runtimes lacking native `Error.isError`). The polyfill/native divergence is documented in
`isError`'s JSDoc: _"The two forms agree on well-behaved code and diverge only on the
legacy edge cases the polyfill admits."_ The `hasErrorPrototypeContract` sub-helper (see
#032) carries the descriptor-walk heuristic that implements the widening — its five checks
(four `Error.prototype` member presence/type assertions plus a trailing-`'Error'` `name`
marker) are the structural-shape proxy for the unobservable `[[ErrorData]]`. The
trailing-`'Error'` `name` check reads through the descriptor chain rather than invoking
`prototype.toString()`, both for the `no-base-to-string` ESLint workaround (see
[[quality-discipline]]) and because the descriptor read aligns with the spec-shape rule
(#020, #021) for own-data properties.
