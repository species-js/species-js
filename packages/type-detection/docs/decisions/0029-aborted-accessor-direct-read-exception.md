# 029 — `aborted` accessor direct-read exception to the spec-shape rule's third pattern

**Date:** 2026-06-04

**Context.** Decision #021 codified a third pattern for the spec-shape access rule:
predicates over inherited properties use descriptor-walk for inspection without
invocation, via `hasInertMethod` and its `objectHasOwn(descriptor, 'value')` rejection of
accessor descriptors. The pattern's load-bearing claim is "no getter fires during the
check." `AbortSignalLike` requires verifying that `aborted` is a boolean — but the spec
defines `aborted` as `[GetterAttribute] readonly attribute boolean`. Native `AbortSignal`
instances return an accessor descriptor for `aborted`. Using `hasInertMethod` here would
reject every native `AbortSignal`.

**Decision.** `doesMatchAbortSignalContract` uses a direct `(value).aborted` read for the
`aborted` boolean check, accepting the spec-defined accessor. The `throwIfAborted` check
still goes through `hasInertMethod` because `throwIfAborted` is a data-property method on
`AbortSignal.prototype` and matches the third pattern cleanly.

**Rationale.** This is a documented deviation from #021, not a violation. The third
pattern's load-bearing contract is "no getter fires that shouldn't fire by spec." For
`aborted`, the spec REQUIRES the getter — the property IS an accessor by spec definition.
Rejecting accessor descriptors here would block the spec contract. The `&&` chain in
`doesMatchAbortSignalContract` ensures the direct read fires only after
`hasInertMethod(value, 'throwIfAborted')` passes — which guarantees `value` is non-nullish
via the parameter-default-to-`null` pattern (#025), so the access can't crash on
null/undefined input.

**Consequences.** Native `AbortSignal` instances correctly pass
`doesMatchAbortSignalContract`. The `aborted` access still triggers any getter the value
carries — but a value whose `aborted` getter throws is, by spec, malformed (the spec
getter just returns the internal state and is side-effect-free). The rule generalizes:
descriptor-walk when invocation is unsafe per the predicate's contract; direct-read when
the spec defines the property as an accessor and invocation IS the spec-required path. The
`&&` chain ordering becomes load-bearing in such cases — the nullish-safe gate must come
first. Future spec-defined accessor properties on other contracts (e.g., `Iterator`'s
`done` flag, ReadableStream's `locked` flag) may need similar exception handling.

**Addendum (2026-06-08).** The original decision noted that a value whose `aborted` getter
throws is malformed by spec — true, but the predicate as originally shipped propagated the
throw out of `doesMatchAbortSignalContract`, violating the boolean-return predicate
contract. The 2026-06-08 audit surfaced this as F7.2: native `AbortSignal` and
well-behaved userland mimicry are unaffected, but adversarial inputs (deliberately
constructed test mocks, buggy implementations) cause unexpected throws in downstream code.
Resolved by wrapping the body in `try`/`catch`:

```js
export function doesMatchAbortSignalContract(value) {
  try {
    return (
      hasInertMethod(value, 'throwIfAborted') &&
      isBooleanValue(value.aborted) &&
      doesMatchEventTargetContract(value)
    );
  } catch {
    return false;
  }
}
```

The trust framing of the original decision is preserved — the spec-defined accessor is
still invoked directly, and the value it returns when it returns one is trusted. The
addendum only extends the trust boundary: if the accessor throws (which the spec says
won't happen for a real `AbortSignal`, but which userland implementations can violate),
the predicate treats the result as failing rather than propagating the throw. Same
exception-handling shape as the boxed-primitive equality helpers
(`doesHaveStrictUnboxedXValueEquality`) use around `prototype.valueOf.call(value)`,
following the pattern from decision #042.

JSDoc in both `.js` and `.d.ts` updated to name the try/catch and the precedent. Future
spec-defined accessor predicates (the foreseen `Iterator.done`, `ReadableStream.locked`
cases) should adopt the same shape: direct-read for spec conformance + try/catch for
predicate-contract safety.
