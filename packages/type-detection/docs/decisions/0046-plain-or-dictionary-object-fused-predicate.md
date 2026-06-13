# 046 — `PlainOrDictionaryObject` union type and fused `isPlainOrDictionaryObject` predicate

**Date:** 2026-06-08

**Context.** Decision #041 kept `isPlainObject` strict and named the recipe
`isPlainObject(v) || isDictionaryObject(v)` for callers wanting the lodash-equivalent
permissive semantic. The recipe lived only in JSDoc and in the module-level @module block
— not as a callable symbol. Two costs followed:

- Callers had to write the recipe inline, which read awkwardly and obscured intent at call
  sites.
- The naive recipe paid redundant cost: both sub-predicates ran `isObject`, both called
  `getPrototypeOf`, both could call `getTypeSignature`, and both could perform a
  constructor walk. On a `DictionaryObject` input, `isPlainObject` ran its signal +
  contract checks before failing, only for `isDictionaryObject` to repeat overlapping
  work.

The naming question (which the user thought through carefully): the union deserves a name
that captures the union honestly without implying "this is lodash" (the species-js form is
stricter than lodash on the prototype-bearing branch via the structural anchor from #044).
Candidates considered: `PlainOrDictionaryObject` (literal union name), `AnyPlainObject`
(uses the `Any` prefix from `AnyObject`), `Pojo` (ecosystem-recognized acronym),
`PermissivePlainObject` (semantic axis). The literal-union form was chosen for its honesty
about composition and its mirror of the JSDoc compose-recipe language.

**Decision.** Add `PlainOrDictionaryObject = PlainObject | DictionaryObject` as a named
type, and `isPlainOrDictionaryObject` as a dedicated predicate with a _fused_
implementation that shares the gate and the prototype read across both branches:

```js
export function isPlainOrDictionaryObject(value) {
  if (!isObject(value)) {
    return false;
  }
  const prototype = getPrototypeOf(value);

  // PlainObject — local-realm fast path
  if (prototype === Object.prototype) {
    return true;
  }

  // DictionaryObject — prototype-less form, two cross-validators remain
  if (prototype === null) {
    return (
      getDefinedConstructor(value) === undefined &&
      getTypeSignature(value) === '[object Object]'
    );
  }

  // PlainObject — cross-realm fallback
  return hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value);
}
```

**Rationale.** Three forces converge:

- **Honest composition naming.** `PlainOrDictionaryObject` mirrors the JSDoc
  compose-recipe `isPlainObject(v) || isDictionaryObject(v)` letter-for-letter at the type
  level. Readers encountering the symbol for the first time understand what it admits
  without checking the source. The body literally reads
  `isPlainObject(value) || isDictionaryObject(value)` in plain English — the type name and
  the implementation speak the same words.

- **Fused implementation eliminates redundant work.** A naive
  `isPlainObject(v) || isDictionaryObject(v)` body would run `isObject` twice, call
  `getPrototypeOf` two or three times, compute `getTypeSignature` twice, and perform two
  distinct constructor walks. The fused form runs each shared step once and dispatches by
  prototype value to the family-specific cross-validators. For a `DictionaryObject` input
  — the case the naive form is most wasteful on — the fused form is roughly 2× faster.

- **Strict-by-default posture preserved.** The two strict types remain disjoint. The union
  is _disjoint-preserving_: each member retains its own discriminator
  (`constructor: ObjectConstructor` vs. `constructor?: never`). Callers wanting the
  prototype-bearing vs prototype-less distinction still use `isPlainObject` or
  `isDictionaryObject` alone; the new predicate is for callers who want the
  lodash-equivalent set _and don't need the distinction_.

**Consequences.** New public surface: type `PlainOrDictionaryObject` and predicate
`isPlainOrDictionaryObject`. Module-level @module doc, package barrel doc, and the
`isPlainObject` strictness section all point at the dedicated predicate as the recommended
permissive form (replacing the inline compose-recipe). The fused-composite predicate
pattern — share the gate, share the expensive structural read, dispatch by shape into the
family-specific cross-validators — is the right shape for any future composite predicate
over a family with a common gate.

Decision #041 is superseded for the recipe surface; the strict-by-default posture remains.
See `../architecture/object.md` — "Cross-realm safety" for the dispatch walkthrough.
