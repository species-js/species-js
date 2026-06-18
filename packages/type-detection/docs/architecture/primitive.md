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
BoxedX        (isBoxedX)   — boxed wrapper-object form via two-branch identity + slot probe
XType         (isX)        — composite admitting either form
```

The three forms compose: `XType = XValue | BoxedX`, and
`isX(v) = isXValue(v) || isBoxedX(v)`. Five families × six exports = 30 exports total (5
value types + 5 boxed types + 5 composite types + 5 value predicates + 5 boxed
predicates + 5 composite predicates).

Three union predicates sit at the floor of the primitive lattice, cross-family, plus a
boxed-side umbrella:

```
BoxablePrimitive   (isBoxablePrimitive)   — typeof-result EXCLUSION over five families
NullishPrimitive   (isNullishPrimitive)   — `null` or `undefined`
PrimitiveValue     (isPrimitiveValue)     — all seven ECMA-262 primitive types
BoxedPrimitive     (isBoxedPrimitive)     — any of the five boxed wrapper-object forms
```

These admit the union across families without consumer-side disjunction. The shapes are
deliberate: `isBoxablePrimitive` is shaped as an EXCLUSION over the three non-primitive
`typeof` results (`'undefined'`, `'function'`, `'object'`) rather than an enumeration over
the five admitted results, which makes it future-proof against new primitive types added
by future ECMA versions. See "Generic primitive predicates" below and decision #051.

## Cross-realm safety

Primitive predicates carry no cross-realm hazard: `typeof` reads identically in every
realm, so `isStringValue` etc. work uniformly across iframe / worker / vm-context
boundaries. The value-only predicates are the simplest and cheapest in the package —
single `typeof` comparisons, O(1).

Boxed predicates do carry the cross-realm concern. A `new String('x')` produced in a
foreign realm has a different `String` constructor identity than the local-realm `String`;
`instanceof String` against it returns `false`. The package handles this with the same
machinery used by `isPromise` / `isEventTarget`: the `[[Class]]` tag read through the
realm-fixed `toObjectString.call` capture, and the constructor-name walked through the
four-source `getDefinedConstructor` fallback in `@/utility`. Both work
realm-independently. The `typeof === 'object'` gate is the cheapest first marker that
rejects primitives and `undefined` in O(1).

## Predicate composition

Three predicates per family, with the boxed predicate driving the marker chain. After
decision #049, the boxed shape splits into two compositions based on whether the family's
intrinsic is a true constructor or a factory function.

**Constructor-aware boxed predicates** (`isBoxedString`, `isBoxedNumber`,
`isBoxedBoolean`):

| Predicate  | Composition                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isXValue` | `typeof v === 'x'`                                                                                                                                                        |
| `isBoxedX` | `isObject(v) && (isCurrentRealmNativeX(v) \|\| (getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X')) && doesHaveStrictUnboxedXValueEquality(v)` |
| `isX`      | `isXValue(v) \|\| isBoxedX(v)`                                                                                                                                            |

**Factory-function boxed predicates** (`isBoxedSymbol`, `isBoxedBigInt`):

| Predicate  | Composition                                                                                                                             |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `isXValue` | `typeof v === 'x'`                                                                                                                      |
| `isBoxedX` | `isObject(v) && getTypeSignature(v) === '[object X]' && getDefinedConstructorName(v) === 'X' && doesHaveStrictUnboxedXValueEquality(v)` |
| `isX`      | `isXValue(v) \|\| isBoxedX(v)`                                                                                                          |

The boxed-X marker chains share two fixtures and split between them. Top: `isObject` as
the O(1) primitive-and-null rejection gate. Bottom: `doesHaveStrictUnboxedXValueEquality`
as the engine-attested `[[XData]]` slot probe via the captured `X.prototype.valueOf` (the
spoof-proof sealing marker — see "The four-marker boxed-primitive discrimination chain"
below).

Between the fixtures the families split:

- **Constructor-aware families** run a **two-branch identity check**. The local-realm fast
  path uses the named helper `isCurrentRealmNativeX` (which combines
  `v instanceof XConstructor` with `getPrototypeOf(v) === xPrototype` for direct-instance
  discrimination). On miss, the cross-realm structural fallback pairs the `[[Class]]` tag
  with the resolved constructor-name. Both arms reject subclasses (proto-identity on the
  local-realm path, constructor-name on the cross-realm path). The slot probe seals either
  branch.
- **Factory-function families** skip the local-realm `instanceof` branch entirely.
  `Symbol` and `BigInt` are factory functions, not constructors — `new Symbol()` and
  `new BigInt()` throw, and `Object(Symbol('x')) instanceof Symbol` evaluates to `true`
  only as an incidental result of `OrdinaryHasInstance` walking the prototype chain, not
  because the spec treats the wrapper as a `Symbol` instance in any identity-bearing
  sense. The four-marker structural chain is the honest discriminator for these families.
  See decision #049.

The `||`-with-shared-seal shape (rather than the ternary used by `isPromise`,
`isEventTarget`, `isAbortSignal`) is decided by **bottom-seal availability**. The
`[[XData]]` slot probe is an engine-attested seal that both arms legitimately feed into —
it is cheap (one `valueOf.call`) and is the spoof-proof guarantee even after the
local-realm arm matches, catching `Object.create(X.prototype)` and similar
proto-identity-spoofing surfaces. The strict-identity predicates in
[`./thenable.md`](./thenable.md) and [`./evented.md`](./evented.md) have no equivalent
shared seal and use a ternary instead. See decisions #049 and #050.

## Conservative-narrowing in the primitive domain

The boxed predicates' marker chain extends the conservative-narrowing posture established
in decision #010 and applied at `isPromise` (#023), `isEventTarget` / `isAbortSignal`
(#028) with engine-attested internal-slot evidence (decision #042) and the local-realm
shortcut on top (decision #049). The chain provides bounded-cost insurance against
single-marker spoofing on the cross-realm arm; the local-realm arm uses `proto-identity`
as its self-sealing single marker (the realm-fixed `X.prototype` cannot be spoofed at the
prototype-identity level from userland):

- Tag-spoofing alone (`Symbol.toStringTag === 'String'` on an arbitrary object) is
  rejected by the constructor-name walk on the cross-realm arm.
- Constructor-name-spoofing alone (a class named `String` that's not the built-in
  `String`) is rejected by the tag check, since the instance carries a different
  `[[Class]]` tag.
- Both structural spoofs together would pass the cross-realm arm's tag + constructor-name
  pair but fail the `[[StringData]]` internal-slot probe — the captured
  `String.prototype.valueOf` throws on any value lacking the engine-attested slot, and the
  slot cannot be forged from userland. At that point the value is structurally AND
  spec-mechanically indistinguishable from a real boxed string — not a spoof but a
  parallel implementation.
- Proto-identity-spoofing on the local-realm arm (`Object.create(String.prototype)` —
  proto matches, no `[[StringData]]`) is rejected by the same slot probe. The probe is the
  shared bottom seal across both arms.

The posture is the same as in [`./function.md`](./function.md),
[`./thenable.md`](./thenable.md), and [`./evented.md`](./evented.md): foundation-tier
predicates that downstream packages depend on benefit from multiple cross-validating
markers as bounded-cost insurance, not just for the typical case but for the spoofing
surface.

## Generic primitive predicates — floor of the lattice

In addition to the per-family surface, the module exposes three union predicates at the
floor of the primitive lattice (decision #051): `isBoxablePrimitive`,
`isNullishPrimitive`, `isPrimitiveValue` — plus the boxed-side umbrella `isBoxedPrimitive`
(decisions #042/#053). Each carries a distinct shape decided by the discrimination problem
it solves:

- **`isBoxablePrimitive`** admits any of the five boxable primitive families (`string`,
  `number`, `boolean`, `symbol`, `bigint`). Shaped as a `typeof`-result **exclusion**
  against a module-top `Set` of the three non-boxable signatures (`'undefined'`,
  `'function'`, `'object'`) rather than an enumeration over the five admitted results. The
  exclusion shape is **future-proof**: every primitive added since ES1 (Symbol in ES6,
  BigInt in ES2020) has arrived with a new `typeof` result distinct from the three
  rejection cases, and the rejection set is spec-locked — modern ECMA does not permit
  implementation-defined `typeof` strings. An enumeration shape would silently fail to
  admit any new primitive type; the exclusion shape admits it without code changes. The
  `typeof === 'object'` rejection covers `null` correctly via the historical bug, and the
  legacy `document.all` quirk (`typeof === 'undefined'`) is rejected via the same arm.
- **`isNullishPrimitive`** admits `null` and `undefined` via the
  parameter-default-to-`null` idiom (decision #025): `value = null` collapses `undefined`
  to `null`, and the body reduces to `value === null`. Combined with the family-pattern
  generic, the `.js` implementation needs a JSDoc cast (`/** @type {T} */ (null)`) on the
  default to bridge the `T` parameter type and the `null` literal — the `.d.ts` contract
  stays uniform.
- **`isPrimitiveValue`** composes `isNullishPrimitive(v) || isBoxablePrimitive(v)`,
  admitting the full ECMA-262 §4.4.4 primitive set — the seven primitive types.

The three `typeof`-floor predicates have **no spoof surface to seal**. Unlike the
boxed-primitive predicates that need the engine-attested `[[XData]]` slot probe to close
`Symbol.toStringTag`-spoofing, predicates that discriminate on `typeof` alone are
spoof-proof at the language level. `typeof` is a syntactic operator, not a method dispatch
— user code cannot intercept or override its result. No slot probe, no constructor walk,
no tag read; each predicate is structurally complete with the single `typeof` evaluation
(and the `value === null` strict-equality for `isNullishPrimitive`). See decision #051 for
the future-proofing rationale and the framing that distinguishes this floor surface from
the per-family surface.

`isBoxedPrimitive` is the boxed-side umbrella, NOT a `typeof`-floor predicate. It admits
any of the five boxed wrapper-object forms (`BoxedString` … `BoxedBigInt`) via the
`isObject` gate and a two-path resolution: the ES3 native hot-path
(`resolvedViaES3NativePrimitiveTypesHotPaths`) for local-realm `String` / `Number` /
`Boolean`, and the alien-realm structural path
(`resolvedViaAlienRealmPrimitiveTypesEvaluation`) for cross-realm forms and every `Symbol`
/ `BigInt` (factory-function carve-out). Unlike the three `typeof`-floor predicates above,
it DOES carry a spoof surface and seals it — the full boxed-discrimination chain including
the `[[XData]]` slot probe. Its two realm-resolution helpers are exported `@internal` so
the cross-realm path is unit-testable with local-realm values (decision #053). See "The
boxed-primitive discrimination chain" above and decisions #042 / #053.

## Generic-typed predicates

All predicates follow the generic-typed family pattern
(`<T = unknown>(value?: T): value is T & X`) shipped in commit `5c5dbe7` (decision #039)
and extended to the floor predicates in decision #051. This includes the value-only
predicates, which decision #036 had originally excluded — that exclusion is superseded
here. The rationale for revisiting: literal-union callers benefit (`'on' | 'off' | number`
narrows to `'on' | 'off'` after `isStringValue`), the boxed and composite predicates
clearly benefit (they narrow to object-shape types), and internal consistency across the
family matters. The pattern is now uniform across value-only, boxed-only, composite, and
generic-floor predicates in `@/primitive`, alongside `@/function`, `@/thenable`,
`@/evented`, and `@/error`. See decision #039 for the full framing.

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

## The boxed-primitive discrimination chain — markers and the local-realm shortcut

The boxed-primitive predicates share two fixtures: the `isObject` gate at the top (O(1)
primitive-and-null rejection) and the spec-precise `[[XData]]` internal-slot probe at the
bottom (decision #042). The slot probe — a captured `X.prototype.valueOf.call(value)` that
throws on any value lacking the slot — is the load-bearing spoof-proof discriminator,
because the `[[XData]]` slot is engine-internal and cannot be installed from userland.

Between the fixtures the marker structure depends on whether the local-realm `instanceof`
shortcut is in play (decision #049):

**Constructor-aware families** (`String`, `Number`, `Boolean`) — two-branch identity check
between the fixtures, markers in cost order:

1. `isObject(value)` — top fixture; O(1) primitive-and-null rejection.
2. Local-realm arm: `isCurrentRealmNativeX(value)` — `instanceof XConstructor` paired with
   `getPrototypeOf(value) === xPrototype` for direct-instance discrimination in two O(1)
   operations. Subclass-rejecting.
3. Cross-realm arm (if 2 fails): `getTypeSignature(value) === '[object X]'` paired with
   `getDefinedConstructorName(value) === 'X'` — `[[Class]]` tag from the realm-fixed
   `toObjectString.call` capture, constructor-name from the four-source walk. Both
   realm-independent; both subclass-rejecting.
4. `doesHaveStrictUnboxedXValueEquality(value)` — bottom fixture; slot probe via the
   captured `prototype.valueOf` reference. Seals either branch.

**Factory-function families** (`Symbol`, `BigInt`) — no local-realm shortcut, four-marker
structural chain only:

1. `isObject(value)` — top fixture.
2. `getTypeSignature(value) === '[object X]'` — `[[Class]]` tag.
3. `getDefinedConstructorName(value) === 'X'` — constructor-name walk.
4. `doesHaveStrictUnboxedXValueEquality(value)` — slot probe; bottom fixture.

The `||`-between-arms + shared-trailer shape on constructor-aware families is the
**bottom-seal-aware** form: both arms feed into the slot probe because the probe is cheap
and is the spoof-proof guarantee even after the local-realm arm matches. Catches
`Object.create(X.prototype)` and similar proto-identity-spoofing surfaces that the
local-realm arm alone would admit. The strict-identity predicates in
[`./thenable.md`](./thenable.md) and [`./evented.md`](./evented.md) use a ternary instead
of `||` precisely because they have no equivalent shared seal — see decision #050 for the
framing.

The chain extends the structural-gate-then-identity-markers pattern from `isPromise`
(decision #023) and `isEventTarget` / `isAbortSignal` (decision #028) with the slot-probe
tier underneath (#042) and the local-realm `instanceof` shortcut on top (#049). The
conservative-narrowing posture (decision #010) is preserved: upstream gates are cheap
fail-fast rejections; the slot probe is the bottom guarantee. A value reaches the slot
probe only after the cheaper markers all pass, so the `try`/`catch` cost is paid only when
the value plausibly _looks_ like a boxed primitive structurally.

The slot probe forecloses the `Symbol.toStringTag`-spoofing surface that the three-marker
version left open: a value with `[Symbol.toStringTag]: 'String'` on a class named `String`
would pass the upstream markers while having no `[[StringData]]`. The slot probe catches
it via the `valueOf` throw. See decision #042.

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
