# 035 — `AbortError` as a name-suffix refinement via template-literal type

**Date:** 2026-06-05

**Context.** The DOM WHATWG `AbortSignal.abort()` rejects with a `DOMException` whose
`name` is `'AbortError'`. `AbortController.abort()` propagates the same convention.
Userland abortable operations frequently prefix their own qualifier
(`'TimeoutAbortError'`, `'UserAbortError'`, `'NavigationAbortError'`) to disambiguate the
cause without losing the convention. The migration question was how to model "the
abort-channel error naming convention" at both the type and predicate levels.

**Decision.** Model the convention via a template-literal type plus a suffix-match
predicate. `` AbortErrorName = `${string}AbortError` `` is the public template-literal
type carrying the naming convention; it admits the empty-prefix case (`'AbortError'`
itself) and arbitrary qualifier prefixes uniformly.
`AbortError = GenericError & { name: AbortErrorName }` is the public structural
intersection layering the suffix-typed `name` field over the base error union.
`isAbortError(v): v is AbortError` is the public refined predicate; it composes
`isError(v)` with `v.name.endsWith('AbortError')` suffix-match. Short-circuit `&&` runs
`isError` first as the cheaper gate; the suffix check fires only after the value is
confirmed an Error (which also guarantees `name` is a string per the Error contract).

**Rationale.** Three forces converge:

- **Suffix-match over exact equality.** Exact equality (`v.name === 'AbortError'`) would
  reject the legitimate qualified variants that the convention explicitly permits. The
  empty-prefix case is included by the template-literal pattern, so the suffix form covers
  both qualified and unqualified instances uniformly.
- **Template-literal type over plain `string`.** `${string}AbortError` carries _real_
  structural information (every assignable string ends with the suffix). It is more
  informative than `string` at the type level, and it documents the convention at the type
  signature where consumers see it. Template-literal types collapse to `string` at the
  runtime level, so the type is structural documentation rather than a runtime guarantee —
  the runtime guarantee is `isAbortError`'s `endsWith` check.
- **Separation from abort-channel mechanics.** `isAbortError` checks _error names only_.
  It does not inspect `AbortSignal.aborted`, link to an `AbortController`, or verify
  abort-channel mechanics. Producer-side inspection of the abort channel belongs to
  predicates in the `evented` module (`isAbortSignal`, `isAbortSignalLike` — see #027,
  #028, #029). The error module discriminates the error _value_; the evented module
  discriminates the channel _producer_. Keeping that separation clean means consumers
  doing error-handling reach for `isAbortError`, consumers doing channel inspection reach
  for `isAbortSignal`, and the two modules don't conflate concerns.

**Consequences.** `isAbortError(new DOMException('aborted', 'AbortError'))` returns
`true`; same for any custom Error class with a name ending in `'AbortError'`.
`isAbortError({ name: 'AbortError' })` returns `false` (not an Error — fails the `isError`
gate). The predicate is the refined narrow target for any consumer discriminating
abort-channel errors from other errors. The future `AbortableThenable<T>` (Q.004) will
type its abort-channel reason against `AbortError`, completing the cross-module
abort-channel surface the thenable round forward-referenced (`AbortSignalLike` in evented;
`AbortError` here; `AbortableThenable<T>` deferred to its own round). See
`../architecture/error.md` for the lattice's positioning within the package.

**Addendum (2026-06-08).** The initial body was
`isError(value) && value.name.endsWith('AbortError')`. The 2026-06-08 audit surfaced an
unaddressed edge case: neither the native `Error.isError` (which inspects only the
`[[ErrorData]]` internal slot per ECMA-262 §20.5.2.2) nor the polyfill's prototype-walk
verify the value's own `name` override. An Error with
`Object.defineProperty(err, 'name', { value: 42 })` carries `[[ErrorData]]` and passes
`isError`; the bare `value.name.endsWith` is then `(42).endsWith` which is `undefined`,
and the predicate throws `TypeError`. The throw violates the predicate contract (callers
expect a boolean). Resolved by gating the suffix-match with `isStringValue(value.name)`:

```js
export function isAbortError(value) {
  return isError(value) && isStringValue(value.name) && value.name.endsWith('AbortError');
}
```

The suffix-match design from the original decision is preserved; the explicit string-type
gate is the precondition the original analysis assumed (incorrectly) the Error contract
guaranteed. JSDoc in both `.js` and `.d.ts` updated to name the explicit gate and to call
out the spec-edge case that motivates it. This is a sharpening of the original decision,
not a reversal — the suffix-match shape and `AbortErrorName` template-literal pattern stay
as designed.
