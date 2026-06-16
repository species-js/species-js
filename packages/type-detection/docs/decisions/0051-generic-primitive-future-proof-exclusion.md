# 051 — Generic-primitive predicates with future-proof exclusion shape

**Date:** 2026-06-16

**Context.** ECMA-262 §4.4.4 defines seven primitive types — Undefined, Null, Boolean,
Number, BigInt, Symbol, String. Five of them (the **wrappable primitives**: Boolean,
String, Number, BigInt, Symbol) carry constructor/wrapper-object duality — each has an
intrinsic that boxes the primitive form to a wrapper-object form, an internal slot
(`[[BooleanData]]`, `[[StringData]]`, …) on the wrapper, and a `typeof` result naming the
family. The remaining two (the **nullish primitives**: Null, Undefined) are terminal
singletons with no constructor, no internal slot, and — for `null` — the historical
`typeof === 'object'` bug.

The `primitive.js` module discriminates the wrappable subset only — three predicates per
family for the primitive form, the boxed form, and their union. The per-family surface
does not expose any predicate that admits the wrappable union across families (e.g., "is
this any value I can pass to `Object(...)` and get a real boxed primitive back"), nor the
nullish-primitive union (`null` or `undefined`), nor the full primitive union (any of the
seven types). Consumers occasionally want these floor-of-the-lattice predicates without
the per-family caller-side disjunction.

A naive enumeration approach to the wrappable-union predicate carries a slow leak. Listing
the five known `typeof` results (`'string' | 'number' | 'boolean' | 'symbol' | 'bigint'`)
would silently fail to admit any new primitive type added in a future ECMA revision — and
the historical pattern (`Symbol` in ES6, `BigInt` in ES2020) makes new primitives a known
design vector. Conversely, the **rejection set** for non-wrappable `typeof` results is
closed and stable: `'undefined'`, `'function'`, and `'object'` cover the entire
non-primitive surface plus `null`, and modern ECMA no longer permits
implementation-defined `typeof` strings.

**Decision.** Add three union predicates at the floor of the primitive lattice in
`primitive.{js,d.ts}`:

- `isWrappablePrimitive(value)` — **`typeof`-result EXCLUSION** against a module-top `Set`
  of the three non-wrappable signatures:

  ```js
  const nonWrappableTypeSignatures = new Set(['undefined', 'function', 'object']);

  export function isWrappablePrimitive(value) {
    return !nonWrappableTypeSignatures.has(typeof value);
  }
  ```

  Admits every `typeof` result outside the rejection set — currently `'string'`,
  `'number'`, `'boolean'`, `'symbol'`, `'bigint'`, and automatically any future addition
  whose `typeof` is distinct from the three rejected signatures. Rejects `null` correctly
  via its `typeof === 'object'` (the historical bug works in our favor here), rejects
  boxed wrapper-object forms (`typeof === 'object'`), and rejects `document.all` via the
  legacy `typeof === 'undefined'` carve-out.

- `isNullishPrimitive(value)` — **parameter-default-to-`null`** (ADR #025) collapsing both
  nullish forms to `null`:

  ```js
  export function isNullishPrimitive(value = /** @type {T} */ (null)) {
    return value === null;
  }
  ```

  `isNullishPrimitive()` and `isNullishPrimitive(undefined)` trigger the default and reach
  `value === null` as `true`; `isNullishPrimitive(null)` reaches the same comparison
  directly; every non-nullish value suppresses the default and fails the comparison. The
  JSDoc cast on the default bridges the generic-T parameter type from the family pattern
  (`<T = unknown>(value?: T)`) and the `null` literal — the cast is the standard tool for
  JSDoc lib-gap acknowledgement (see CLAUDE.md → "Types live where the file's syntax
  expects them").

- `isPrimitive(value)` — composes the nullish and wrappable arms via short-circuit `||`:

  ```js
  export function isPrimitive(value) {
    return isNullishPrimitive(value) || isWrappablePrimitive(value);
  }
  ```

Three type aliases ship alongside:

- `WrappablePrimitive = StringValue | NumberValue | BooleanValue | SymbolValue | BigIntValue`
- `NullishPrimitive = null | undefined`
- `Primitive = WrappablePrimitive | NullishPrimitive`

All three predicates follow the family-pattern generic shape from #031 / #038:
`<T = unknown>(value?: T): value is T & X`.

**Rationale.** Five forces converge:

- **Exclusion is future-proof; enumeration is not.** The rejection set is closed and
  stable; modern ECMA does not permit implementation-defined `typeof` strings, and every
  primitive added since ES1 has arrived with a new `typeof` result distinct from the three
  rejection cases. An enumeration-based shape would force a code change on every new
  primitive type. An exclusion-based shape admits new primitives without modification. The
  future-proofing is not the only justification — the predicate has a real present-day use
  case — but it is a deliberate property of the shape, not incidental.

- **The `typeof === 'object'` rejection of `null` works in the predicate's favor.** A
  single `typeof`-result check rejects both `null` AND every non-primitive object, with no
  separate nullish guard needed. The historical bug becomes a structural affordance.

- **Parameter-default-to-`null` for the nullish collapse.** ADR #025 established the
  pattern of defaulting a parameter to `null` so that `value === null` covers both nullish
  forms with a single strict-equality test. The same idiom applies here. The generic-T
  family pattern requires a JSDoc cast on the default to bridge `T` and the literal
  `null`; the `.d.ts` contract stays uniform (`value?: T`) and the cast is internal to the
  `.js` implementation.

- **No spoof surface to seal.** Unlike the boxed-primitive predicates (#042, #043, #049)
  that need an engine-attested `[[XData]]` slot probe to close `Symbol.toStringTag`
  spoofing, predicates that discriminate on `typeof` alone are spoof-proof at the language
  level. `typeof` is a syntactic operator, not a method dispatch — user code cannot
  intercept or override its result. No slot probe, no constructor walk, no tag read; the
  predicate is structurally complete with the single `typeof` evaluation.

- **Family-pattern generics applied uniformly.**
  `<T = unknown>(value?: T): value is T & X` preserves caller-side narrowing through the
  predicate; `T = unknown` collapses to the bare union. Applied across all three new
  predicates, so the form is consistent with the rest of the module — value-only,
  boxed-only, composite, and now generic predicates all share the family shape. Decision
  #038's consistency rationale extends.

**Consequences.** Three new public predicates plus three new type aliases at the floor of
the primitive lattice. The new surface admits unions the per-family predicates could not
express without caller-side disjunction.

Future-ECMA primitive types are admitted by `isWrappablePrimitive` without code changes.
This property is a contract, not an accident — module-level prose names the
future-proofing rationale explicitly, so the exclusion shape is preserved against
regressive "simplification" attempts (a future contributor tempted to flatten the
predicate to an enumeration would lose the future-proofing without realizing it).

The `null` and `undefined` singletons are recognized as a distinguished subfamily of
primitives, named "nullish" in alignment with the canonical ECMAScript vocabulary (`??`,
`?.`). The `Primitive` union does not narrow the per-family `XValue` aliases — those
remain the canonical primitive-form types for type-narrowing flows; `Primitive` is the
union ceiling, not a replacement.

Commit pending. See [`../architecture/primitive.md`](../architecture/primitive.md) for the
per-module mental-model update that accompanies this decision.
