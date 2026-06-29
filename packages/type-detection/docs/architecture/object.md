# type-detection / object

## Mental model

`type-detection / object` discriminates non-null, non-function objects into three
type-system shapes that match three runtime characteristics, plus a fourth named union
that captures the lodash-equivalent permissive form:

```
AnyObject                 (isObject)                    — non-null, non-function object
  ├── PlainObject         (isPlainObject)               — constructor === Object
  └── DictionaryObject    (isDictionaryObject)          — no prototype chain
PlainOrDictionaryObject   (isPlainOrDictionaryObject)   — PlainObject | DictionaryObject
```

The first three are a real subtype relationship: every `PlainObject` is an `AnyObject`;
every `DictionaryObject` is an `AnyObject`. `PlainObject` and `DictionaryObject` are
mutually exclusive at runtime (an object cannot simultaneously have `Object.prototype` as
its prototype and have no prototype) and at the type level (their `constructor` property
constraints are disjoint). `PlainOrDictionaryObject` is the named union of the two strict
forms — disjointness is preserved (each member retains its own discriminator); the name
captures the union without losing the distinction.

The four shapes correspond to four common consumer needs:

- **`AnyObject`** — the structural floor. "I know this isn't `null`, isn't `undefined`,
  isn't a primitive, isn't a function. I want to index into it."
- **`PlainObject`** — the lookup-table / record / DTO case. "I want a plain
  `Object`-constructed value, not a class instance, not an array, not a built-in
  container."
- **`DictionaryObject`** — the hashmap case. "I want a prototype-less object so my
  user-supplied keys can't collide with `Object.prototype` members."
- **`PlainOrDictionaryObject`** — the lodash-equivalent case. "I want any 'real' object
  (no class machinery), whether prototype-bearing or prototype-less."

## The structural discriminator: `constructor` property

The type-level discrimination matches the runtime discrimination:

- `PlainObject extends AnyObject` adds `constructor: ObjectConstructor` — required
  property of the specific built-in `Object` constructor type. Runtime characteristic:
  `getPrototypeOf(value) === Object.prototype` (local-realm fast path) or the cross-realm
  structural anchor — two cheap string-shape signal markers
  (`[[Class]] === '[object Object]'` + constructor name `'Object'`) plus a five-marker
  prototype contract on the constructor reached from `value`'s prototype (see "Structural
  anchor for `isPlainObject`" below).

- `DictionaryObject extends AnyObject` adds `constructor?: never` — optional property
  typed as `never`, meaning "either absent or, if present, of type `never`." Runtime
  characteristic: `getPrototypeOf(value) === null`,
  `getDefinedConstructor(value) === undefined`, AND
  `getTypeSignature(value) === '[object Object]'` (the tag cross-validator closes the rare
  own-`Symbol.toStringTag` tampering surface).

- `PlainOrDictionaryObject = PlainObject | DictionaryObject` — named union of the two
  strict forms. Disjointness preserved per-member. Runtime characteristic: the union of
  the two characteristics above; the predicate fuses them to share a gate and a prototype
  read.

The two strict types are type-disjoint at the TypeScript level because `ObjectConstructor`
is not assignable to `never`. No brand, no fiction — the discrimination IS the runtime
characteristic, modeled at the type level via the constructor property.

This contrasts with the equip-js source's `__objectBrand__: unique symbol` approach, which
forced the three types into _sibling_ positions (not subtypes), required brand property on
the values (nothing carries it at runtime), and was unverifiable by any predicate. The
species-js form rejects branding here for the same reason decision #001 rejected branding
for type-name string aliases: brands are appropriate only when same-shaped values must not
be interchanged across a directional flow, and they cannot carry runtime provenance. The
object-family distinction is structurally real via constructor and the type-level
discrimination should match that. See decision #040.

## Cross-realm safety

`isObject` is realm-independent — `!!value && typeof value === 'object'` reads the same in
every realm.

`isPlainObject` composes a local-realm fast path with a cross-realm-safe structural
anchor:

```js
isObject(value) &&
  (getPrototypeOf(value) === objectPrototype ||
    (hasPlainObjectIdentitySignal(value) && hasPlainObjectPrototypeContract(value)));
```

The fast path (`getPrototypeOf === objectPrototype`) catches the common case in a single
reference comparison. `objectPrototype` is the realm-fixed `Object.prototype` capture from
`@/config` — taken once at module-load so the comparison is immune to a post-load
reassignment of `globalThis.Object`. The structural anchor catches cross-realm Plain
Objects whose prototype is the _other_ realm's `Object.prototype` (different reference,
same structural shape). The signal half is two cheap string-shape markers; the contract
half is the five-marker spec-mechanic-anchored chain detailed below.

`isDictionaryObject` is realm-orthogonal because prototype-less is prototype-less
regardless of realm:

```js
isObject(value) &&
  getPrototypeOf(value) === null &&
  getDefinedConstructor(value) === undefined &&
  getTypeSignature(value) === '[object Object]';
```

The fourth marker (`getTypeSignature === '[object Object]'`) closes the rare surface where
a prototype-less object has been hand-decorated with an own `Symbol.toStringTag` property
to lie about its `[[Class]]` — for the hashmap semantic the type targets, a tag would
never be set legitimately.

`isPlainOrDictionaryObject` is a _fused_ implementation rather than a naive
`isPlainObject(v) || isDictionaryObject(v)` composition: one shared `isObject` gate, one
shared `getPrototypeOf` read, then dispatch by prototype value (`=== objectPrototype` →
accept; `=== null` → verify the two non-prototype cross-validators; else → the cross-realm
contract walk). The fusion eliminates a redundant constructor walk and a redundant tag
computation that would otherwise fire on `DictionaryObject` inputs.

The `getPrototypeOf` reads in the snippets above are the conceptual operation; the
implementation routes EVERY descriptor and prototype read in the detection paths through a
throw-safe reader, so a type-guard answers a boolean on every input — including a hostile
`Proxy` — rather than propagating a trap's throw (hardened during the 2026-06-25 test
round, decision-aligned with #056/#057/#029):

- **Prototype reads** → `getInertPrototypeOf` (`@/utility`, the #057 wrapper). A throwing
  `getPrototypeOf` trap yields `undefined` — matching neither `objectPrototype` nor
  `null`.
- **The five-marker contract** (`hasPlainObjectPrototypeContract`) reads the constructor's
  own `name` via `getVerifiedOwnName` (#059) and its `prototype` round-trip via
  `getInertDescriptor` (#056), not raw `getOwnPropertyDescriptor`.
- **`isClass`** (`@/function`) was the upstream root cause — it did its own raw
  `getOwnPropertyDescriptor(value, 'prototype')`, so a hostile constructor threw there
  before object's own markers ran. Root-fixed to route through `getInertDescriptor`
  (#056), which makes every `isClass` consumer throw-safe for free. The from-every-angle
  adversarial probe — a SURGICAL hostile constructor that throws only for `'prototype'`
  and so passes the cheap identity-signal gate — is what drove the hostile value into this
  surface and exposed it; a blanket-throwing Proxy is caught earlier by the throw-safe
  signal gate.

The prototype is also resolved ONCE per call and threaded into
`hasPlainObjectPrototypeContract(value, prototype)` (the #059 threading learning),
eliminating the redundant re-read the helper would otherwise perform on the cross-realm
path.

## Structural anchor for `isPlainObject`

The cross-realm fallback in `isPlainObject` pairs two cheap string-shape signal markers
with a five-marker spec-mechanic-anchored prototype contract. The shape:

```js
export function hasPlainObjectIdentitySignal(value) {
  return (
    getTypeSignature(value) === '[object Object]' &&
    getDefinedConstructorName(value) === 'Object'
  );
}

export function hasPlainObjectPrototypeContract(value) {
  const prototype = getPrototypeOf(value);
  const constructor =
    isObject(prototype) && getDefinedConstructor(prototype, { assumePrototype: true });

  return (
    isClass(constructor) &&
    getTypeSignature(prototype) === '[object Object]' &&
    getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object' &&
    getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype &&
    getPrototypeOf(prototype) === null
  );
}
```

Both helpers are `@internal`-tagged and ship with parallel `.d.ts` declarations carrying
the same walkthrough — applying decision #015's "All sub-helpers exported with parallel
`.d.ts` declarations" uniformly across the family. The function module's
`hasAsyncFunctionIdentitySignal` + `hasAsyncFunctionPrototypeSurface` pairing is the
established precedent.

The `{ assumePrototype: true }` option on `getDefinedConstructor` is load-bearing here.
The `prototype` argument is the result of `getPrototypeOf(value)` — by construction, a
real prototype object whose own `constructor` descriptor is the spec-mandated source per
ECMA-262 §10.2.6. The option tells `getDefinedConstructor` to start its descriptor walk at
the value itself rather than walking one level up; without it, the function would
overshoot the canonical local-realm `Object.prototype` case (walking to `null` and
returning `undefined`) and break the round-trip identity check that follows. See decision
#047 for the pivot semantics and the option's full rationale.

The contract markers in cost order:

1. **`isClass(constructor)`** — the constructor reached via
   `getDefinedConstructor(prototype, { assumePrototype: true })` is a built-in or
   `class`-syntax newable. Rejects fake-`constructor`-pointer spoofs where the value's
   `constructor` is tampered to reference a non-function value.
2. **Prototype's own `[[Class]]` tag** —
   `getTypeSignature(prototype) === '[object Object]'`. Real `Object.prototype`s tag
   uniformly across realms.
3. **Constructor's own `name` via own descriptor** —
   `getOwnPropertyDescriptor(constructor, 'name')?.value === 'Object'`. The
   descriptor-via-`.value` read skips accessors: an accessor-form definition (`get`/`set`)
   yields `undefined` and fails the check.
4. **Round-trip identity via own descriptor** —
   `getOwnPropertyDescriptor(constructor, 'prototype')?.value === prototype`. Verifies the
   constructor's own `prototype` data property points back to the prototype walked from
   `value`. Closes the tampered-`constructor`-pointer spoof at its root: even if
   `value.constructor` is the global `Object`, the constructor's `Object.prototype` must
   equal the prototype the value actually carries.
5. **Chain-depth invariant** — `getPrototypeOf(prototype) === null`. Every realm's
   `Object.prototype` has a `[[Prototype]]` of `null`; class instances and built-in
   container instances have at least two prototype-chain levels.

The descriptor-via-`.value` discipline (markers 3, 4) is uniform with `isClass`'s own use
of `getOwnPropertyDescriptor(value, 'prototype')?.writable === false`. Reading own data
via descriptors — never via direct property access — is the rule across the prototype
contract: it skips inherited properties (closing inheritance-based spoofs) and skips
accessor-form definitions (closing the lying-getter spoof). See decision #044.

The residual spoof surface is an attacker who constructs `FakeCtor` with a writable:false
own `prototype` data property pointing to a hand-crafted `fakeProto` (`[[Prototype]]`
null) and `FakeCtor.name === 'Object'`. At that point they have reconstructed the spec
mechanics of `Object` from scratch — structurally indistinguishable from a foreign realm's
`Object`. Not a spoof; a parallel implementation.

## Cross-module: `BlankType` ↔ `DictionaryObject`

`BlankType` in `@/utility` is `Record<PropertyKey, never>` — the _sentinel_ form of a
prototype-less object: no keys statically reachable. Used as a blank-descriptor sentinel
in `@/error`'s `hasErrorPrototypeContract` heuristic via the `objectCreate(null)` retyped
return in `@/config` (decisions #017, #034).

`DictionaryObject` is the _populated_ form: `Record<PropertyKey, unknown>` extended with
the `constructor?: never` discriminator. Used as a typed hashmap with arbitrary
user-supplied keys.

Per TypeScript variance, `BlankType` is a structural subtype of `DictionaryObject`
(`Record<PropertyKey, never>` is a subtype of `Record<PropertyKey, unknown>` because
`never` is the bottom type and a subtype of `unknown`). The two are not interchangeable in
API contracts because the consumer intent differs (sentinel vs hashmap), but they coexist
cleanly in the type system. Both are cross-referenced in their respective modules' JSDoc.

## `isPlainObject` strictness vs lodash `_.isPlainObject`

Lodash's `_.isPlainObject` is _permissive_ — it admits both prototype-bearing objects
(constructor === Object) AND prototype-less objects (`Object.create(null)`). The
species-js form is _strict_ — `isPlainObject` admits only the prototype-bearing form; the
prototype-less form has its own dedicated predicate, `isDictionaryObject`.

The lodash semantic is recovered through the dedicated permissive predicate:

```ts
const matchesLodashSet = isPlainOrDictionaryObject(v);
// equivalent to: isPlainObject(v) || isDictionaryObject(v)
```

`isPlainOrDictionaryObject` is a _fused_ implementation that shares the gate and the
prototype read across both branches rather than running the two strict predicates
back-to-back; see "Cross-realm safety" for the dispatch. The named permissive form
captures the lodash compatibility under one symbol without losing the strict-form
distinction the underlying types still carry.

The strict-by-default, compose-for-lenient posture is consistent with `isPromise`
rejecting subclasses (decision #023), `isEventTarget` / `isAbortSignal` rejecting
subclasses (#028), and `AbortError` requiring the suffix-match (#035). See decisions #041
and #046.

## Open architectural questions

_Section currently empty — the object module's surface is complete. The `identity`
migration that the equip-js source carried alongside `object` belongs to
`@species-js/type-identity`, not here._
