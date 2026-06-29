# object — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`object.d.ts`, `object.js`,
> `architecture/object.md`, decisions #040, #041, #044, #045, #046, #047). Status:
> **FROZEN 2026-06-18** — decidability check passed (6 suites over all 4 public
> predicates + the 2 exported helpers, via the `@/index.js` barrel, single realm). The run
> corrected one stale doc-comment claim — the `isDictionaryObject` `getDefinedConstructor`
> cross-validator admits (not rejects) an attached own `constructor` key (#047); the
> `object.{js,d.ts}` comments were fixed. Base for the axis-1 suite; axes 2–4 derive
> alongside. Amended 2026-06-25 (test round) — throw-safety hardening (every descriptor /
> prototype read routes through a throw-safe reader, incl. the `isClass` root-fix in
> `@/function`) + #059 prototype-threading; public admit/reject verdicts unchanged, new
> `*/B1`–`B3` adversarial vectors — see Resolved items #2. Amended 2026-06-29 (test round)
> — the five-marker anchor became a **six-marker** anchor (the member-surface marker, a
> new `doesImplementObjectPrototypeContract` helper); the cross-realm anchor was renamed
> `hasPlainObjectPrototypeContract → isObjectPrototypeEquivalent` and now takes the
> already-resolved `[[Prototype]]` (one arg, #059); the dictionary signal was extracted
> into a new `hasDictionaryObjectIdentitySignal` helper; and a #059-threading regression
> on `isPlainObject(Object.prototype)` was found and fixed (false→true→**false**),
> restoring PlainObject/DictionaryObject disjointness — see Resolved items #3.
> Re-validated 2026-06-29 — adopted the package-wide clean throw-safety model (universal
> invariant + axis-3 `hostile × predicate` matrix; refuses-to-claim demoted to prose),
> withdrew the per-input public throw-safety vectors into the matrix, kept the
> helper-level boundaries (`dIOPC/B1`, new `iOPE/B1`), and fixed the
> `hasDictionaryObjectIdentitySignal` operand order in the `isDictionaryObject` prose; no
> admit/reject verdict changed — see Resolved items #4.

## Module contract

`type-detection / object` discriminates non-null, non-function objects into three runtime
shapes plus a named union:

```
AnyObject               (isObject)                  — non-null, non-function object
  ├── PlainObject        (isPlainObject)             — direct constructor is built-in Object
  └── DictionaryObject   (isDictionaryObject)        — no prototype-chain (Object.create(null))
PlainOrDictionaryObject (isPlainOrDictionaryObject)  — PlainObject | DictionaryObject (lodash-equiv)
```

`PlainObject` and `DictionaryObject` are mutually exclusive (constructor === Object vs. no
prototype) and type-disjoint (`constructor: ObjectConstructor` vs. `constructor?: never`).
The disjointness is structural: `isPlainObject` rejects every prototype-less value (its
`!!prototype` guard — see below), so a null-prototype object is never plain.
`Object.prototype` itself is the boundary case — being prototype-less with no reachable
constructor it is a **DictionaryObject, not a PlainObject** (`isDictionaryObject/A4`,
`isPlainObject/R7`). `isPlainObject` is **strict** (rejects `Object.create(null)`); the
lodash-permissive set is the fused `isPlainOrDictionaryObject`. Decisions #040 (structural
subtype over branding), #041/#046 (strict-vs-lodash), #044 (six-marker anchor), #045
(dictionary tag cross-validator), #047 (`getDefinedConstructor` pivot).

### Throw-safety (the universal invariant)

Every predicate answers a boolean on **every** input, including hostile ones, and never
propagates a throw: `isObject` / `isPlainObject` / `isDictionaryObject` /
`isPlainOrDictionaryObject` return their honest verdict on any throw on any path, and
every `@internal` helper returns its sentinel (`false` for the boolean probes) so the
composing predicate collapses to `false`. The hostile-input classes this module's reads
are exposed to, and the throw-safe reader each routes through:

- **prototype-trap** (a `Proxy` whose `getPrototypeOf` throws) → `getInertPrototypeOf`;
- **descriptor-trap** (a `Proxy` whose `getOwnPropertyDescriptor` throws — on the value,
  on a pivoted `[[Prototype]]`, or on a hostile `constructor`) → `getInertDescriptor`,
  `getDefinedConstructor` / `getDefinedConstructorName`, `getVerifiedOwnName`, and
  `isClass` (each throw-safe at its own read; `isClass` root-fixed in `@/function`);
- **ownKeys-trap** (a `Proxy` whose `ownKeys` throws) → the `try/catch`-wrapped
  `getOwnPropertyDescriptors` inside `doesImplementObjectPrototypeContract` (marker 6);
- **tag-getter-throw** (a throwing `Symbol.toStringTag`) → `getTypeSignature`.

Two honest-by-contract verdicts follow, not leaks. **`isObject`** is the realm-independent
floor — a `typeof` check, zero prototype/descriptor/tag reads — so an object-typed hostile
`Proxy` is admitted (`true`), never thrown. A **throwing-tag plain object** splits by
realm: the local-realm `prototype === objectPrototype` fast-path admits it
(`isPlainObject` / `isPlainOrDictionaryObject` → `true`) because the fast-path
short-circuits **before** any tag read, whereas the same value from a foreign realm fails
the fast-path and falls to the structural arm, which reads the tag via `getTypeSignature`
and **rejects** (`false`) — a realm asymmetry, same value, opposite plain-object verdict.
This throwing-tag split is one instance of a general, deliberate property — a local plain
object's surface tampering is invisible to the identity fast-path but decisive for the
cross-realm structural arm; see
[`isPlainObject` → **Realm asymmetry on tampered inputs**](#realm-asymmetry-on-tampered-inputs-deliberate).

The exhaustive `hostile-class × predicate` proof lives in the test suite (axis 3), not
here — see [`./README.md`](./README.md) → "Throw-safety — the universal invariant". The
member-surface `ownKeys`-trap and the standalone `isObjectPrototypeEquivalent`
throw-safety are **helper-level** boundaries (`dIOPC/B1`, `iOPE/B1`), kept as axis-4
vectors.

## Surface inventory

**Public predicates (axis 1):** `isObject`, `isPlainObject`, `isDictionaryObject`,
`isPlainOrDictionaryObject`.

**Exported `@internal` helpers (axis 4):**

- `hasPlainObjectIdentitySignal` — two inexpensive plain-object string-shape markers (tag
  `'[object Object]'` + constructor-name `'Object'`).
- `hasDictionaryObjectIdentitySignal` — the dictionary counterpart (tag
  `'[object Object]'` and NO reachable constructor).
- `isObjectPrototypeEquivalent` — the six-marker prototype contract over an
  already-resolved `[[Prototype]]` (one arg, threaded by the caller per #059).
- `doesImplementObjectPrototypeContract` — marker 6 in isolation: the prototype's own
  member surface against the host-calibrated canonical `Object.prototype` member set.

Exporting these is what makes the cross-realm structural arm of `isPlainObject`
unit-testable on **local** values (the helpers carry no local-realm fast-path, so they run
the realm-independent logic directly — no `vm` realm needed). The unexported seam
`isAlienRealmPlainObject(value, prototype) = hasPlainObjectIdentitySignal(value) && isObjectPrototypeEquivalent(prototype)`
is covered transitively through the two helpers it composes.

**Exported types without a predicate:** `AnyObject`, `PlainObject`, `DictionaryObject`,
`PlainOrDictionaryObject`.

Re-confirmation gate: 8 `.js` exports = 8 `.d.ts` declarations, no surface gap;
`architecture/object.md` matches the code (no drift).

## Cross-cutting vectors

- **CC/nullish** — `null`, `undefined`, omitted → rejected by all four (the `isObject`
  gate).
- **CC/primitive** — `'x'`, `42`, `true`, `Symbol()`, `1n`, and falsy
  `0`/`''`/`false`/`NaN` → rejected (`!!value` + `typeof === 'object'`).
- **CC/function** — `() => {}`, `class {}`, `function(){}` → rejected
  (`typeof === 'function'`).

---

## `isObject`

`isObject<T = unknown>(value?: T): value is T & AnyObject` —
`!!value && typeof value === 'object'`. Realm-independent.

- `isObject/A1` — `{}`, `{ a: 1 }` → true.
- `isObject/A2` — `[]`, `new Date()`, `new Map()`, `/re/` → true (containers/instances are
  objects).
- `isObject/A3` — `Object.create(null)` → true (prototype-less still an object).
- `isObject/A4` — `new String('x')`, `new Number(1)` → true (boxed primitives are
  objects).
- `isObject/A5` — `new (class Foo {})()` → true (class instance).
- `isObject/R1` — primitives, nullish, functions → false (CC vectors).

**Cross-realm (axis 2):** trivially realm-safe (`typeof` is realm-independent). **Spoof:**
none (syntactic operator).

---

## `isPlainObject`

`isPlainObject<T = unknown>(value?: T): value is T & PlainObject` Composition: the
`isObject` gate, then the prototype is resolved ONCE
(`prototype = getInertPrototypeOf(value)`, #059) and
`!!prototype && (prototype === objectPrototype || isAlienRealmPlainObject(value, prototype))`.

The `!!prototype` guard is a deliberate O(1) **dictionary fast-reject**: a plain object
always has a (some realm's) `Object.prototype`, so a `null` prototype (a dictionary, or
`Object.prototype` itself) and an `undefined` prototype (a throw-safe
`getInertPrototypeOf` result on a hostile trap) are rejected before the signal +
six-marker walk runs — and can never reject a true positive.

- `isPlainObject/A1` — `{}`, `{ a: 1 }`, `new Object()`, `Object.create(Object.prototype)`
  → true (local-realm fast-path: proto === `objectPrototype`).
- `isPlainObject/A2` — a cross-realm plain object (fixture) → true (structural arm:
  signal + six-marker contract). The structural _logic_ is pinned in-realm by the helper
  specs below.
- `isPlainObject/A3` — a **local** plain object carrying a tampered `Symbol.toStringTag`
  (a spoofed `'NotObject'` string, or a throwing getter) → **true**. The local-realm
  fast-path is `prototype === objectPrototype` (pure identity), which short-circuits
  _before_ any tag read — so surface tampering is invisible to it. This is correct, not a
  leak: the value genuinely has `Object.prototype` as its `[[Prototype]]`, so it really is
  a plain `Object` instance; a cosmetic tag does not change its constructor identity. See
  the **Realm asymmetry on tampered inputs** note below — the cross-realm counterpart is
  rejected.
- `isPlainObject/R1` — `[]` (constructor `Array`), `new Date()`, `new Map()`, `/re/` →
  false.
- `isPlainObject/R2` — `new (class Foo {})()` → false (constructor `Foo`, not `Object`).
- `isPlainObject/R3` — `Object.create(null)` → false (null prototype → the `!!prototype`
  fast-reject; that's `isDictionaryObject`).
- `isPlainObject/R4` — `new String('x')` → false (tag `'[object String]'`, proto
  `String.prototype`).
- `isPlainObject/R5` — `Object.create({ a: 1 })` → false (proto is a
  non-`Object.prototype` plain object; fails fast-path; contract marker 4 round-trip and
  marker 5 chain-depth fail).
- `isPlainObject/R6` — a value over a hollow `class extends null` whose `name` is
  redefined to `'Object'` → false. Its prototype satisfies the five identity markers (1–5)
  — null-rooted, tag `'[object Object]'`, own ctor-name `'Object'`, round-tripping
  `prototype` — yet carries only `constructor`, none of `Object.prototype`'s methods. The
  **member-surface marker 6** (`doesImplementObjectPrototypeContract`) is the sole marker
  that rejects it.
- `isPlainObject/R7` — `Object.prototype` → false (its own `[[Prototype]]` is `null` → the
  `!!prototype` fast-reject). This preserves PlainObject/DictionaryObject disjointness:
  `Object.prototype` is a dictionary, not a plain object (`isDictionaryObject/A4`).
- (plus CC/nullish, CC/primitive, CC/function.)

**Refuses to claim** (prose — semantic scope, asserts nothing): prototype-less objects
(delegated to `isDictionaryObject`).

Throw-safety against a `getPrototypeOf` trap (former `isPlainObject/B1`), a surgical /
blanket hostile `constructor` descriptor-trap (former `isPlainObject/B2`), and a pivoted
`[[Prototype]]` descriptor-trap (former `isPlainObject/B3`) is the universal invariant
(see the Module contract's _Throw-safety_ paragraph) and is proven by the axis-3
`hostile × predicate` matrix in the test suite. Those per-input vectors are **withdrawn**,
subsumed by the matrix — no behavior changed. **Cross-realm (axis 2):** admit
foreign-realm plain objects via the structural arm. **Spoof (axis 3):** the six-marker
contract closes the tampered-`constructor`-pointer spoof (round-trip identity marker 4),
the lying-accessor spoof (descriptor-via-`.value` on markers 3/4), the class/container
instances (chain-depth marker 5), and the hollow `class extends null` renamed `'Object'`
(member-surface marker 6). Residual: a from-scratch reconstruction of `Object`'s spec
mechanics that ALSO installs the full canonical member set = a parallel implementation,
not a spoof (`dIOPC/A2`). **Composition note (axis 4):** `isObject` gate →
`getInertPrototypeOf` once → `!!prototype` reject → fast-path `objectPrototype` ref →
`isAlienRealmPlainObject` (`hasPlainObjectIdentitySignal` +
`isObjectPrototypeEquivalent`).

### Realm asymmetry on tampered inputs (deliberate)

`isPlainObject` answers via two arms that weigh evidence differently, and for a
**tampered** input they can disagree _by realm_:

- **Local-realm arm** — `prototype === objectPrototype`, pure identity. It is **blind to
  surface tampering**: a local plain object with a spoofed or throwing
  `Symbol.toStringTag` (or any other surface marker tampering) is still admitted (`true`,
  `isPlainObject/A3`), because identity is decisive — the value genuinely has the real
  `Object.prototype`, so it genuinely is a plain `Object` instance.
- **Cross-realm arm** — `hasPlainObjectIdentitySignal` + `isObjectPrototypeEquivalent`,
  structural. Lacking a local `Object.prototype` to match on, it has **only** surface
  markers to go on, so the same tampering (spoofed tag → tag mismatch; throwing tag →
  `getTypeSignature` yields `undefined`) makes it **reject** (`false`).

So the _same_ structurally-tampered object can read `true` locally and `false`
cross-realm. This is **inherent to having a fast identity path at all**, and the local
answer is the more-correct one (identity outranks a cosmetic marker). It is **not** a
defect and is **not** reconciled: forcing the local fast-path to also read the tag would
cost its O(1)-identity nature and would wrongly reject a genuine local plain object.
**Every _legitimate_ (untampered) plain object agrees across realms** (`true`); the
divergence appears _only_ under tampering. The throwing-tag instance is pinned by the
axis-3 throw-safety matrix (local `true` / alien `false`); the non-throwing spoofed-tag
instance is pinned in `adversarial.test.js`.

---

## `isDictionaryObject`

`isDictionaryObject<T = unknown>(value?: T): value is T & DictionaryObject` Composition:
`isObject(value) && getInertPrototypeOf(value) === null && hasDictionaryObjectIdentitySignal(value)`,
where the two non-gate cross-validators (`getTypeSignature(value) === '[object Object]'`
and `getDefinedConstructor(value) === undefined`, in that short-circuit order — cheap tag
first, matching the helper formula) are bundled in the helper:

- `getInertPrototypeOf === null` is the spec-correct, throw-safe test for "no
  prototype-chain." `Object.create(null)` is the canonical way to reach this state, but
  any object whose prototype was later set to `null` via
  `Object.setPrototypeOf(obj, null)` also passes.
- `getDefinedConstructor === undefined` is the structural cross-validator: the four-source
  constructor walk resolves no real constructor. The walk deliberately ignores an own
  `constructor` data property (#047), so a prototype-less hashmap carrying a user-supplied
  `constructor` key is still admitted — the key is data, not a reachable constructor.
- `getTypeSignature === '[object Object]'` is the tag cross-validator closing the rare
  surface where a prototype-less object has been hand-decorated with an own
  `Symbol.toStringTag` to lie about its `[[Class]]`.

- `isDictionaryObject/A1` — `Object.create(null)` → true.
- `isDictionaryObject/A2` — `Object.setPrototypeOf({}, null)` → true (prototype later
  null-ed).
- `isDictionaryObject/A3` — `Object.assign(Object.create(null), { constructor: Object })`
  → **true** — a prototype-less hashmap carrying a user-supplied `'constructor'` data key
  is still a dictionary. `getDefinedConstructor` deliberately ignores an own `constructor`
  property (#047), so the key is data, not a reachable constructor. (This corrected a
  stale doc claim — see Resolved items #1.)
- `isDictionaryObject/A4` — `Object.prototype` → **true**. Its own `[[Prototype]]` is
  `null` and, with #047 ignoring its own `constructor`, the walk resolves no reachable
  constructor; the tag is `'[object Object]'`. This is the disjoint counterpart of
  `isPlainObject/R7`: `Object.prototype` is classified as a dictionary, never a plain
  object.
- `isDictionaryObject/R1` — `{}` → false (proto `Object.prototype`).
- `isDictionaryObject/R2` — `[]`, `new Date()`, `new (class {})()` → false (non-null
  proto).
- `isDictionaryObject/R3` — `Object.create({ a: 1 })` → false (non-null proto).
- `isDictionaryObject/R4` — a prototype-less object hand-decorated with own
  `Symbol.toStringTag` → false (the `getTypeSignature === '[object Object]'`
  cross-validator rejects the spoofed tag).
- (plus CC vectors.)

**Refuses to claim** (prose — semantic scope, asserts nothing): prototype-bearing plain
objects (that's `isPlainObject`).

Throw-safety against a `getPrototypeOf` trap (former `isDictionaryObject/B1`, the trap →
`undefined ≠ null`) is the universal invariant (axis-3 matrix); the per-input vector is
**withdrawn**, no behavior changed. **Cross-realm (axis 2):** realm-orthogonal —
prototype-less is prototype-less in every realm. **Spoof (axis 3):** the
`getTypeSignature === '[object Object]'` cross-validator closes the spoofed-tag surface
(`R4`). The `getDefinedConstructor === undefined` marker does NOT reject an attached own
`constructor` key (it is ignored by design, #047 — see `A3`); it is defense-in-depth
paired with `getInertPrototypeOf === null`. **Composition note (axis 4):** `isObject` +
`getInertPrototypeOf` (`@/utility`) + `hasDictionaryObjectIdentitySignal`
(`getDefinedConstructor` + `getTypeSignature`, `@/utility`).

---

## `isPlainOrDictionaryObject`

`isPlainOrDictionaryObject<T = unknown>(value?: T): value is T & PlainOrDictionaryObject`
Fused: one `isObject` gate + one throw-safe `getInertPrototypeOf` read, then dispatch by
prototype value — `=== objectPrototype` → accept; `=== null` →
`hasDictionaryObjectIdentitySignal(value)`; else →
`isAlienRealmPlainObject(value, prototype)` (the cross-realm plain-object contract).

Note the asymmetry with `isPlainObject` on a `null` prototype: `isPlainObject` rejects it
(never plain), whereas the fused predicate routes it to the dictionary branch — so a
null-proto value can still be admitted here as a dictionary.

- `isPlainOrDictionaryObject/A1` — `{}`, `new Object()` → true (plain, fast-path).
- `isPlainOrDictionaryObject/A2` — `Object.create(null)` → true (dictionary branch).
- `isPlainOrDictionaryObject/A3` — a cross-realm plain object (fixture) → true
  (cross-realm fallback).
- `isPlainOrDictionaryObject/A4` — `Object.prototype` → true (dictionary branch; matches
  `isDictionaryObject/A4`).
- `isPlainOrDictionaryObject/R1` — `[]`, `new Date()`, `new (class Foo {})()` → false.
- `isPlainOrDictionaryObject/R2` — `Object.create({ a: 1 })` → false
  (non-`objectPrototype`, non-null proto; fails the contract walk).
- `isPlainOrDictionaryObject/R3` — a hollow `class extends null` renamed `'Object'` →
  false (cross-realm branch; member-surface marker 6 rejects it, as in
  `isPlainObject/R6`).
- (plus CC vectors.)

Throw-safety against a `getPrototypeOf` trap (former `isPlainOrDictionaryObject/B1`, the
trap → `undefined`, matching neither dispatch branch → structural fallback → false) is the
universal invariant (axis-3 matrix); the per-input vector is **withdrawn**, no behavior
changed.

**Cross-realm / spoof (axes 2, 3):** inherits from the two strict predicates it fuses.
**Composition note (axis 4):** shares the gate + prototype read; drives
`hasDictionaryObjectIdentitySignal` (null branch) and `isAlienRealmPlainObject`
(`hasPlainObjectIdentitySignal` + `isObjectPrototypeEquivalent`, else branch).

---

## Helper specification (axis 4)

### `hasPlainObjectIdentitySignal(value?)` — `@internal`

`getTypeSignature(value) === '[object Object]' && getDefinedConstructorName(value) === 'Object'`.

- `hPOIS/A1` — `{}`, `new Object()`, `Object.create(Object.prototype)` → true.
- `hPOIS/R1` — `[]` (tag `'[object Array]'`), `new Date()` (tag `'[object Date]'`) →
  false.
- `hPOIS/R2` — `Object.create(null)` → false (constructor-name resolves to `undefined`,
  not `'Object'`).
- `hPOIS/R3` — `new (class Foo {})()` → false (constructor-name `'Foo'`).

### `hasDictionaryObjectIdentitySignal(value?)` — `@internal`

`getTypeSignature(value) === '[object Object]' && getDefinedConstructor(value) === undefined`.
The dictionary counterpart of `hasPlainObjectIdentitySignal`: same tag marker, but it
expects NO reachable constructor instead of constructor-name `'Object'`. Reused by
`isDictionaryObject` and the `prototype === null` branch of the fused
`isPlainOrDictionaryObject`.

- `hDOIS/A1` — `Object.create(null)` → true (tag `'[object Object]'` + no reachable
  constructor).
- `hDOIS/A2` — `Object.assign(Object.create(null), { constructor: Object })` → true (the
  own `constructor` key is ignored, #047 — so still no reachable constructor).
- `hDOIS/R1` — `{}` → false (constructor resolves to `Object`, not `undefined`).
- `hDOIS/R2` — a prototype-less object with a spoofed own `Symbol.toStringTag` → false
  (the tag cross-validator rejects the lie).

### `isObjectPrototypeEquivalent(prototype?)` — `@internal` (the six-marker cross-realm anchor; takes the already-resolved `[[Prototype]]`, #059; runs the realm-independent logic on local values)

Markers, short-circuited in cost-order:

1. `isClass(constructor)` — the constructor reached via
   `getDefinedConstructor(prototype, { assumePrototype: true })` is a built-in or
   `class`-syntax newable.
2. `getTypeSignature(prototype) === '[object Object]'` — the prototype's own `[[Class]]`
   tag matches.
3. `getVerifiedOwnName(constructor) === 'Object'` — the constructor's own `name` reads
   `'Object'` (throw-safe; accessor-form `name` yields `undefined`).
4. `getInertDescriptor(constructor, 'prototype').value === prototype` — round-trip
   identity (throw-safe; accessor-form yields `undefined`).
5. `getInertPrototypeOf(prototype) === null` — chain-depth check (top-level prototype).
6. `doesImplementObjectPrototypeContract(prototype)` — member-surface check: the prototype
   carries every canonical `Object.prototype` member as its own non-enumerable callable.

- `iOPE/A1` — the `[[Prototype]]` of `{}` / `new Object()` → true (all six markers hold
  for a real `Object.prototype`).
- `iOPE/R1` — the `[[Prototype]]` of `[]` → false (marker 2:
  `getTypeSignature(Array.prototype)` is `'[object Array]'`).
- `iOPE/R2` — the `[[Prototype]]` of `new (class Foo {})()` → false (marker 3: constructor
  `name` is `'Foo'`, not `'Object'`).
- `iOPE/R3` — a `null` prototype (`Object.create(null)`'s) → false (`isObject(prototype)`
  is false → no constructor → `isClass` fails).
- `iOPE/R4` — a hand-crafted prototype carrying a `constructor` tampered to point at the
  global `Object` → false (round-trip marker 4:
  `Object.prototype !== the hand-crafted prototype`).
- `iOPE/R5` — the `[[Prototype]]` of a hollow `class extends null` renamed `'Object'` →
  false. Satisfies markers 1–5; only the member-surface marker 6 rejects it.
- `iOPE/B1` — a prototype carrying a hostile `constructor` whose
  `getOwnPropertyDescriptor` trap throws (surgical: only on `'prototype'`, reaching
  markers 3/4; blanket: every key, caught at marker 1 `isClass`) → false, **not thrown**.
  The helper-level throw-safety boundary (parallel to `dIOPC/B1`): invoked standalone with
  no signal gate in front, it must itself be throw-safe at `isClass` +
  `getVerifiedOwnName` + `getInertDescriptor`.

### `doesImplementObjectPrototypeContract(value?)` — `@internal` (marker 6 in isolation)

Throw-safe `getOwnPropertyDescriptors(value)`, then every name in the host-calibrated
canonical member set (the seven core ES members plus whichever Annex-B accessor helpers
this engine exposes, calibrated once and memoized) must be present as a non-enumerable,
callable-valued **own** data property. Reads own descriptors only — never inherited.

- `dIOPC/A1` — a real `Object.prototype` (the `[[Prototype]]` of `{}`) → true (full
  canonical member surface).
- `dIOPC/A2` — a hand-built null-proto prototype carrying the FULL canonical member set as
  non-enumerable callables → true. The documented residual: the structural contract closes
  the cheap spoof, not every conceivable one.
- `dIOPC/A3` — augmentation-tolerant: extra own properties (a polyfill, a monkeypatched
  method) do not break it (presence of the canonical set, not set equality).
- `dIOPC/R1` — the `[[Prototype]]` of a hollow `class extends null` renamed `'Object'` →
  false (carries only `constructor`, none of the canonical members).
- `dIOPC/R2` — `Array.prototype` → false (own, not inherited: it inherits the `Object`
  methods rather than owning them).
- `dIOPC/R3` — a prototype carrying the full canonical member NAMES but with the wrong
  descriptor SHAPE (one accessor-form, one enumerable, one non-callable value) → false.
  `isValidObjectPrototypeDescriptor` requires each member to be a non-enumerable,
  callable-valued **data** property; this closes the "right names, wrong shape" spoof the
  residual `dIOPC/A2` does not.
- `dIOPC/B1` — a hostile `Proxy` prototype whose `ownKeys` trap throws → false, **not
  thrown** — the `getOwnPropertyDescriptors` read is wrapped in a `try/catch`. Reachable
  only standalone (the predicate path fails marker 1 before marker 6 runs).

---

## Resolved items

1. **`isDictionaryObject` doc-comment inaccuracy (doc↔impl) — RESOLVED.** The decidability
   run caught a stale claim: `object.js` + `object.d.ts` stated that the
   `getDefinedConstructor === undefined` cross-validator "catches cases where the
   prototype is null but a `constructor` property has been explicitly attached to the
   value (a real spoof surface the cross-validator closes)." Verified false —
   `getDefinedConstructor` deliberately ignores an own `constructor` data property (#047),
   so `isDictionaryObject(Object.assign(Object.create(null), { constructor: Object }))` is
   **admitted** (`A3`), not rejected. The implementation is correct (a hashmap with a
   `'constructor'` key is still a dictionary); the doc-comments were corrected to describe
   the marker's real behavior (defense-in-depth paired with
   `getInertPrototypeOf === null`). `architecture/object.md` needed no change (it already
   attributed spoof-closing to the tag cross-validator only). Both structural helpers were
   already exported `@internal` (no #053-style action needed).

2. **Throw-safety hardening (impl change, 2026-06-25 test round) — RESOLVED.** The test
   round surfaced a throw surface across the object detection paths; the first pass fixed
   only one of its four reads, and an every-angle adversarial probe (a SURGICAL hostile
   constructor) exposed the rest. User ruling: **harden** the whole path (matching the
   thenable/evented treatment), not document-the-throw — including the cross-module root
   cause. The complete set of reads now routes through throw-safe readers:
   - **Prototype reads** (`isPlainObject`, `isDictionaryObject`,
     `isPlainOrDictionaryObject`) → `getInertPrototypeOf` (#057), replacing raw
     `getPrototypeOf` (`@/config`).
   - **Marker 3** (constructor `name`) → `getVerifiedOwnName` (#059); **marker 4**
     (constructor `prototype` round-trip) → `getInertDescriptor` (#056), replacing raw
     `getOwnPropertyDescriptor`.
   - **`isClass` root-fix (`@/function`, cross-module, user green-lit).** `isClass` did
     its own raw `getOwnPropertyDescriptor(value, 'prototype')` — the throw originated
     there, upstream of object's markers. Routed through `getInertDescriptor` (#056);
     every `isClass` consumer is now throw-safe for free. (The sibling `hasOwnPrototype` /
     `hasOwnWritablePrototype` helpers carry the same raw-read surface — a finding
     deferred to the `function` round; object does not depend on them.)

   Decision-aligned with #056/#057/#029 (no new ADR — same trust-boundary posture).

3. **Six-marker member-surface anchor + #059 threading regression (impl change, 2026-06-29
   test round) — RESOLVED.** Three coupled changes landed while bringing the `object` test
   suite green:
   - **Member-surface marker 6.** The five-marker anchor admitted a hollow
     `class extends null` whose `name` was redefined to `'Object'`: its prototype is
     null-rooted, brands `'[object Object]'`, owns a `'Object'`-named round-tripping
     constructor, yet carries none of `Object.prototype`'s methods. Added marker 6
     (`doesImplementObjectPrototypeContract`) — the own member surface against a
     host-calibrated canonical set — which is the only marker that rejects it
     (`isPlainObject/R6`, `iOPE/R5`, `dIOPC/*`). The anchor was renamed
     `hasPlainObjectPrototypeContract → isObjectPrototypeEquivalent` and now takes the
     already-resolved `[[Prototype]]` (one arg, #059), not `value`. The dictionary signal
     was extracted into `hasDictionaryObjectIdentitySignal` (mirrors
     `hasPlainObjectIdentitySignal`). Surface gate moved 6 → 8 exports.
   - **Load-cycle fix.** `object` participates in the
     `config → primitive → object → config` import cycle. The member-surface calibration
     first ran as an eager module-top-level IIFE touching the `@/config` captures
     (`getOwnPropertyDescriptors`, `objectPrototype`) — which are still uninitialized when
     `object`'s body executes mid-cycle, so every test failed at import
     (`getOwnPropertyDescriptors is not a function`). Moved to a lazy, memoized
     `getObjectPrototypeDescriptorNames()`: the captures are read only at first call,
     never at module load — the same "no load-time work in the cycle" rule every other
     config consumer already follows.
   - **`isPlainObject(Object.prototype)` regression — found & fixed.** The #059 threading
     rewrite had introduced
     `prototype = value === objectPrototype ? objectPrototype : getInertPrototypeOf(value)`,
     which routed `Object.prototype` itself into the local-realm fast-path and flipped
     `isPlainObject(Object.prototype)` from **false → true**. Because
     `isDictionaryObject(Object.prototype)` is true, this broke
     PlainObject/DictionaryObject mutual exclusivity. Fixed by dropping the special-case
     (`prototype = getInertPrototypeOf(value)`) and adding the `!!prototype` dictionary
     fast-reject; `isPlainObject(Object.prototype)` is **false** again, `Object.prototype`
     is a dictionary only (`isPlainObject/R7`, `isDictionaryObject/A4`), disjointness
     holds. Verified empirically (mutual-exclusivity + union battery, incl.
     foreign-realm).

   Decision-aligned with #044/#056/#057/#059 (no new ADR — same anchor and trust-boundary
   posture, one additional structural marker).

4. **Re-validation pass (2026-06-29) — clean throw-safety model + operand-order fix.** The
   module was re-validated under the two-round verification gauntlet and adopted the
   package-wide clean model (see `docs/spec/README.md` → "Throw-safety — the universal
   invariant"). Three changes, **no public admit/reject verdict altered** (the 2026-06-25
   hardening already made the code throw-safe; this pass reorganizes the spec + tests to
   the convention):
   - **Throw-safety promoted to a universal invariant**, stated once in the Module
     contract and proven by an axis-3 `hostile × predicate` matrix in the test suite
     (`test/object/throw-safety.test.js` + `throwSafetyMatrix`). The former per-input
     public throw-safety vectors `isPlainObject/B1`–`B3`, `isDictionaryObject/B1`,
     `isPlainOrDictionaryObject/B1` are **withdrawn** (IDs retired, behavior unchanged);
     the refuses-to-claim notes are demoted to **prose**. The helper-level throw-safety
     boundaries keep their IDs: `dIOPC/B1` (member-surface `ownKeys`-trap) and a new
     `iOPE/B1` (the standalone `isObjectPrototypeEquivalent` throw-safety, relocated from
     `adversarial.test.js` to `_internal/helpers.test.js`, parallel to thenable's
     `hPIS/B1`). The matrix added two coverage gains over the old vectors: the `isObject`
     floor column (a hostile `Proxy` is honestly an object — `true`, never thrown) and the
     realm-asymmetry tag-getter pair (local fast-path admits a throwing-tag plain object;
     the foreign structural arm reads the tag and rejects).
   - **Operand-order fix.** The `isDictionaryObject` composition prose listed the two
     bundled cross-validators constructor-first; the code and the canonical
     `hasDictionaryObjectIdentitySignal` helper formula are tag-first
     (`getTypeSignature(...) && getDefinedConstructor(...)`, cheap-tag-first per the
     least-expensive-first rule). The prose now matches.
   - **Realm-asymmetry ruling (user, design authority).** The matrix surfaced that
     `isPlainObject` can return `true` locally and `false` cross-realm for the _same_
     tampered object (a spoofed / throwing `Symbol.toStringTag`). Ruled a **deliberate,
     accepted property**, not a defect: the local fast-path is identity-based and blind to
     surface tampering (the value genuinely has `Object.prototype`); the cross-realm arm
     is structural and tag-sensitive. Reconciling would cost the fast-path's O(1) identity
     and wrongly reject a genuine local plain object. Documented as a named property
     (`isPlainObject` → "Realm asymmetry on tampered inputs"), a new admission vector
     `isPlainObject/A3` (local tampered-tag plain object → `true`), the `.js`/`.d.ts`
     JSDoc, and pinned by both the throw-safety matrix (throwing tag) and an
     `adversarial.test.js` pair (non-throwing spoofed tag). Every legitimate plain object
     still agrees across realms; the divergence appears only under tampering.

No open items.
