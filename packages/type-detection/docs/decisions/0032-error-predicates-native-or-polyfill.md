# 032 — Error predicates: layered composition with native-or-polyfill capture

**Date:** 2026-06-05

**Context.** The equip-js source had five public exports for error discrimination —
`isCurrentRealmError`, `isAlienRealmError`, `isGenericError`, `isError`, `isAbortError` —
plus an internal `hasMatchingErrorPrototype` helper. The first three were the
realm-fast-path / structural-fallback / composing-polyfill triple. `isError` captured
native `Error.isError` when available; otherwise it delegated to the polyfill.
`isAbortError` was a suffix-match refinement. The migration question was whether to port
all six surfaces verbatim or to consolidate them per the established lattice patterns from
`thenable` and `evented`.

**Decision.** Collapse the realm-fast-path / structural-fallback split into a single
polyfill body, mirroring the way `isEventTargetLike` (#027) and `isPromiseLike` (thenable
round, #022) compose their `instanceof <Constructor>` fast path with
`doesMatch<X>Contract` structural fallback inside one predicate without exposing the two
halves separately. The resulting composition stack:

1. `hasErrorPrototypeContract` (`@internal`) — descriptor-walk sub-helper that verifies
   the four `Error.prototype` own descriptors (`constructor`, `message`, `name`,
   `toString`) plus a trailing-`'Error'` `name` marker, with a recursive `isError`
   fallback for the prototype-itself-is-an-Error case (`Object.create(new Error())`).
2. `doesMatchErrorContract` (`@internal`) — structural fallback dispatcher; admits
   `[[Class]]` tag `'[object Error]'` (every `[[ErrorData]]`-bearing value per ECMA-262
   §20.1.3.6 step 17), `'[object DOMException]'` (WebIDL's separate tag), or
   `'[object Object]'` with prototype passing `hasErrorPrototypeContract` (the legacy
   `Object.create(Error.prototype)` and ES3-style cases). Parallel to
   `doesMatchPromiseContract` (thenable), `doesMatchEventTargetContract`,
   `doesMatchAbortSignalContract` (evented).
3. `isGenericError` (`@internal`) — polyfill body that composes `value instanceof Error`
   (realm-fast-path) with `doesMatchErrorContract` (structural fallback) inside a single
   predicate. Inlines what equip-js had exposed as separate `isCurrentRealmError` and
   `isAlienRealmError` exports.
4. `isError` (public) — captures native `Error.isError` at module-load when the runtime
   provides it (ES2025+); falls back to `isGenericError` otherwise. Bound as
   `const isError = isFunction(nativeIsError) ? nativeIsError : isGenericError`. The
   capture is realm-fixed — later tampering with `globalThis.Error.isError` does not reach
   this binding, mirroring the realm-fixed pattern used for cached `@/config` primitives.
5. `isAbortError` (public) — refines `isError` via name-suffix match against
   `AbortErrorName`; see #035.

**Rationale.** Three forces converge on the consolidated shape:

- **Lattice symmetry with thenable / evented.** Each higher-level subdomain has the same
  shape: `@internal` structural sub-helper(s), `@internal` contract dispatcher, public
  umbrella predicate, optional refined predicate. Maintaining that symmetry across
  subdomains keeps the docs and the mental model uniform — a contributor reading one
  module's structure can navigate any other module's by the same shape.
- **Surface minimalism.** Equip-js exposed five public predicates where two suffice. The
  realm-fast-path / structural-fallback split is implementation, not interface; collapsing
  them into `isGenericError` removes two exports without losing capability (the polyfill
  body remains exported `@internal` for testing and for callers wanting polyfill semantics
  irrespective of native).
- **Native-or-polyfill capture at module-load.** `Error.isError` only exists in ES2025+
  runtimes (Node 23+, modern browsers). Capturing once at module-load — as opposed to
  re-reading `globalThis.Error.isError` at each call — makes the binding realm-fixed and
  immune to later tampering, matching the realm-fixed posture used for cached `@/config`
  primitives.

**Consequences.** Public surface: `GenericError`, `AbortErrorName`, `AbortError`,
`isError`, `isAbortError`. `@internal` surface: `ErrorConstructorES2025`,
`ErrorConstructorWithIsError`, `hasErrorPrototypeContract`, `doesMatchErrorContract`,
`isGenericError`. Five fewer top-level public surfaces than the equip-js source. The
polyfill widening semantic — what `isGenericError` admits beyond the spec-precise
`[[ErrorData]]` check — is captured separately in #033. The `objectCreate` boundary
retyping that the descriptor walk depends on for clean typing is captured in #034.
`AbortError` as a name-suffix refinement is captured in #035. See
`../architecture/error.md` for the conceptual map.
