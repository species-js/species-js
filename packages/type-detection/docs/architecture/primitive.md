# type-detection / primitive

## Mental model

`type-detection / primitive` discriminates JavaScript's five primitive families (`string`,
`number`, `boolean`, `symbol`, `bigint`) and their boxed wrapper-object forms
(`new String('x')`, `Object(42)`, `Object(Symbol('y'))`, etc.). Each primitive type in
JavaScript has two runtime forms — the primitive value and the boxed wrapper — that differ
on `typeof` (`'string'` vs `'object'`), on identity (`===`), and on prototype-method
invocation (boxed forms expose `String.prototype` methods directly; primitives auto-box
transparently for method access). Most JavaScript code treats the two interchangeably via
implicit coercion, but type-system discrimination needs to name the distinction.

The module ships three predicates and three types per family:

```
XValue        (isXValue)   — primitive form via `typeof`
BoxedX        (isBoxedX)   — boxed wrapper-object form via four cross-validating markers
XType         (isX)        — composite admitting either form
```

The three forms compose: `XType = XValue | BoxedX`, and
`isX(v) = isXValue(v) || isBoxedX(v)`. Five families × six exports = 30 exports total (5
value types + 5 boxed types + 5 composite types + 5 value predicates + 5 boxed
predicates + 5 composite predicates).

## Cross-realm safety

Primitive predicates carry no cross-realm hazard: `typeof` reads identically in every
realm, so `isStringValue` etc. work uniformly across iframe / worker / vm-context
boundaries. The value-only predicates are the simplest and cheapest in the package —
single `typeof` comparisons, O(1).

Boxed predicates do carry the cross-realm concern. A `new String('x')` produced in a
foreign realm has a different `String` constructor identity than the local-realm `String`;
`instanceof String` against it returns `false`. The package handles this with the same
machinery used by `isPromise` / `isEventTarget`: the `[[Class]]` tag read through the
realm-fixed `toObjectString.call` capture, and the constructor name walked through the
four-source `getDefinedConstructor` fallback in `@/utility`. Both work
realm-independently. The `typeof === 'object'` gate is the cheapest first marker that
rejects primitives and `undefined` in O(1).

## Predicate composition

Three predicates per family, with the boxed predicate driving the marker chain. The
following table shows the structural shape; replace `X` with `String` / `Number` /
`Boolean` / `Symbol` / `BigInt` and `x` with the lowercase form for the family instance.

| Predicate  | Composition                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `isXValue` | `typeof v === 'x'`                                                                                      |
| `isBoxedX` | `typeof v === 'object' && getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X'` |
| `isX`      | `isXValue(v) \|\| isBoxedX(v)`                                                                          |

The marker order for `isBoxedX` is performance-first:

- **`typeof === 'object'`** is the O(1) primitive-rejection gate. Rejects primitive
  strings (which share the `'[object String]'` tag), all other primitives, `undefined`,
  and functions in one comparison. Admits `null` momentarily — but the tag check then
  rejects via `'[object Null]'`.
- **`getTypeSignature(v) === '[object X]'`** is the type discriminator. Reads through the
  realm-fixed `toObjectString.call` capture, so cross-realm boxed values are admitted on
  contract. Rejects plain objects, arrays, `Date`, `Map`, etc.
- **`getDefinedConstructorName(v) === 'X'`** is the constructor-identity cross-validator.
  Closes the `Symbol.toStringTag`-spoofing hole the tag check alone would leave open — a
  `class Spoof { get [Symbol.toStringTag]() { return 'String'; } }` instance passes the
  tag check but its constructor name resolves to `'Spoof'`, rejecting it here.

The order also mirrors the structural-gate-then-identity-markers pattern from `isPromise`
(decision #023) and `isEventTarget` / `isAbortSignal` (decision #028): a fast structural
gate, then two realm-independent identity refinements.

## Conservative-narrowing in the primitive domain

The boxed predicates' four-marker chain extends the conservative-narrowing posture
established in decision #010 and applied at `isPromise` (#023), `isEventTarget` /
`isAbortSignal` (#028) with engine-attested internal-slot evidence (decision #042). The
marker chain provides bounded-cost insurance against single-marker spoofing:

- Tag-spoofing alone (`Symbol.toStringTag === 'String'` on an arbitrary object) is
  rejected by the constructor-name walk.
- Constructor-name-spoofing alone (a class named `String` that's not the built-in
  `String`) is rejected by the tag check, since the instance carries a different
  `[[Class]]` tag.
- Both structural spoofs together would pass the first three markers but fail the
  `[[StringData]]` internal-slot probe — the captured `String.prototype.valueOf` throws on
  any value lacking the engine-attested slot, and the slot cannot be forged from userland.
  At that point the value is structurally AND spec-mechanically indistinguishable from a
  real boxed string — not a spoof but a parallel implementation.

The posture is the same as in [`./function.md`](./function.md),
[`./thenable.md`](./thenable.md), and [`./evented.md`](./evented.md): foundation-tier
predicates that downstream packages depend on benefit from multiple cross-validating
markers as bounded-cost insurance, not just for the typical case but for the spoofing
surface.

## Generic-typed predicates

All 15 predicates follow the generic-typed family pattern
(`<T = unknown>(value?: T): value is T & X`) shipped in commit `5c5dbe7` (decision #039).
This includes the value-only predicates, which decision #036 had originally excluded —
that exclusion is superseded here. The rationale for revisiting: literal-union callers
benefit (`'on' | 'off' | number` narrows to `'on' | 'off'` after `isStringValue`), the
boxed and composite predicates clearly benefit (they narrow to object-shape types), and
internal consistency across the family matters. The package-wide tally is now 36
generic-typed predicates across `@/function`, `@/thenable`, `@/evented`, `@/error`, and
`@/primitive`. See decision #039 for the full framing.

## Wrapper-object types

The `BoxedX = X & object` types (`BoxedString = String & object`, etc.) intentionally use
TypeScript's wrapper-object types — the `String`, `Number`, `Boolean`, `Symbol`, `BigInt`
interfaces from `lib.es5.d.ts` — as the load-bearing distinction from the primitive forms.
The `& object` intersection excludes the primitive arms.

The `@typescript-eslint/no-wrapper-object-types` rule's default advice ("prefer the
primitive `string` over `String`") is correct for typical TypeScript code but wrong here:
this is precisely the case where the wrapper-object type is the structural model. A
per-file override scoped to `**/src/primitive.d.ts` in `eslint.config.js` disables the
rule for the boxed-type declarations, with an inline rationale matching the existing
override-with-rationale style in the config. Per the zero-`eslint-disable` policy
([[quality-discipline]]), the fix is configuration at the right level, not inline
suppression. See decision #038 for the full framing.

## The four-marker boxed-primitive discrimination chain

The boxed-primitive predicates use a four-marker chain that adds a spec-precise
`[[XData]]` internal-slot probe to the three structural markers shipped originally
(decision #038). The slot probe — a captured `X.prototype.valueOf.call(value)` that throws
on any value lacking the slot — is the load-bearing spoof-proof discriminator, because the
`[[XData]]` slot is engine-internal and cannot be installed from userland.

Markers in performance order:

1. `!!value` — O(1) null-rejection gate.
2. `typeof value === 'object'` — O(1) primitive-rejection gate.
3. `getTypeSignature(value) === '[object X]'` — `[[Class]]` tag from the realm-fixed
   `toObjectString.call` capture.
4. `getDefinedConstructorName(value) === 'X'` — constructor name from the four-source
   walk.
5. `doesHaveStrictUnboxed{X}ValueEquality(value)` — slot probe via the captured
   `prototype.valueOf` reference.

The chain extends the structural-gate-then-identity-markers pattern from `isPromise`
(decision #023) and `isEventTarget` / `isAbortSignal` (decision #028) with one more tier
underneath. The conservative-narrowing posture (decision #010) is preserved: the four
upstream gates are cheap fail-fast rejections; the slot probe is the bottom guarantee. A
value reaches the slot probe only after the cheaper markers all pass, so the `try`/`catch`
cost is paid only when the value plausibly _looks_ like a boxed primitive structurally.

The slot probe forecloses the `Symbol.toStringTag`-spoofing surface that the three-marker
version left open: a value with `[Symbol.toStringTag]: 'String'` on a class named `String`
would pass markers 1–4 while having no `[[StringData]]`. Marker 5 catches it via the
`valueOf` throw. See decision #042.

## Per-family equality strategies

Implementing marker 5 surfaced that the equality check between unboxed value and boxed
value has **four different correct shapes across the five families**, driven by the spec
mechanics of each constructor's coercion path:

| Family    | Equality form                                   | Spec trap avoided                                                               |
| --------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| `String`  | `valueOf.call(v) === String(v)`                 | None — both sides unwrap via `ToPrimitive`                                      |
| `Number`  | `Object.is(valueOf.call(v), Number(v))`         | `NaN !== NaN` for `new Number(NaN)`; `Object.is` is `SameValue`                 |
| `Boolean` | `String(valueOf.call(v)) === String(v)`         | `ToBoolean(Object) → true` for any object; `String()` unwraps via `ToPrimitive` |
| `Symbol`  | `valueOf.call(v).description === v.description` | `Symbol(boxedSym)` throws; description equality catches own-property shadowing  |
| `BigInt`  | `valueOf.call(v) === BigInt(v)`                 | None — `BigInt()` unwraps via `ToPrimitive`                                     |

Five families, four different strategies. The variation is _spec-inherent_, not an
implementation artifact: the constructor coercion paths genuinely differ across the five
wrapper types, and attempting unification by parameterizing one helper would either lose
precision (silently re-introducing the Boolean / NaN regressions) or special-case its way
back to per-family logic via runtime branches. The species-js form ships five focused
helpers, each named for its family, each documented with the spec-mechanic rationale. See
decision #043 and the `[[boxed-primitive-discrimination]]` memory for the per-family
walkthrough.

Notable in the Symbol case: the description equality is _not_ redundant with the slot
probe. The valueOf throws on any value lacking `[[SymbolData]]`, but a real boxed Symbol
whose `description` property has been shadowed by an own data property
(`Object.defineProperty(boxed, 'description', { value: 'tampered' })`) still passes the
valueOf. The description cross-check catches that one residual tampering surface —
`unboxedValue.description` reads from the slot, `value.description` reads through the
(shadowed) accessor chain, mismatch → reject. Conservative-narrowing posture applied to
the tampering surface that survives the slot probe.

## Realm-fixed captures: boundary-retyping vs pure capture

`objectIs = Object.is` was added to `@/config` to support the Number-family equality
strategy. It is a _pure_ realm-fix capture — the lib type for `Object.is` is already
precise (`(value1: any, value2: any) => boolean`), so no boundary-retyping is needed. This
is distinct from the boundary-retyping pattern of decisions #008, #017, #026, #034, which
retype `any` returns to spec-precise types at the `@/config` boundary specifically to
close consumer-side `any`-cascades.

Both patterns share the realm-fix benefit (pinning the captured reference to this realm's
identity, immune to later tampering with the global). They differ on the type-system side:
boundary-retyping changes the captured primitive's declared type at the `@/config`
boundary; pure capture leaves the type as-is. `objectIs` is the second realm-fix-only
capture, alongside `toObjectString`'s pure-capture nature in the
captures-for-cross-realm-tag-reading set. The two patterns coexist within the same
`@/config` family.

The minor implication: not every `@/config` cached primitive needs a `.d.ts` retyping. The
boundary-retyping ruling in `[[design-rulings]]` should be read as _"when the lib type
forces an `any`-cascade, retype at the boundary,"_ not as _"every captured primitive must
be retyped."_ `objectIs` is the canonical example of the realm-fix-only form: type is
already precise; only the realm capture matters.

## Module-local capture vs `@/config` promotion

The five `prototype.valueOf` references for the boxed-equality helpers
(`String.prototype.valueOf`, `Number.prototype.valueOf`, etc.) live at the top of
`primitive.js` rather than at `@/config`. They share the same realm-fix semantics as
`@/config`'s captures but stay scoped to where they're used. The rule of thumb: a captured
primitive earns promotion to `@/config` when a second module needs it. Module-local is the
default for first-use; promotion is the response to second-use. Today the
prototype-valueOf captures are first-use; if `@species-js/type-identity` or a future
module needs them, promotion is mechanical.

## Open architectural questions

_Section currently empty — the primitive module's surface is complete. Further
nominal-branding or string-tag refinements (e.g. distinguishing `UserId` from `OrderId`
when both are `string`) belong in `@species-js/type-identity`, not here (decision #001)._
