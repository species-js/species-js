# function — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`function.d.ts`, `function.js`,
> `architecture/function.md`, decisions #003–#007, #009–#016, #019, #031, #049). Status:
> **FROZEN 2026-06-19** — decidability check passed (45 suites over all 11 public
> predicates + `hasConstructSlot` + the 9 exported `@internal` helpers, via the
> `@/index.js` barrel, single realm). The run surfaced that `Symbol`/`BigInt` classify as
> built-in classes (they carry a throwing `[[Construct]]` slot); the design owner ruled
> the implementation correct — newability is slot presence, orthogonal to throw-on-`new` —
> and the spec vectors were corrected to admit them (see Resolved items #1). One neutral
> clarifying note was added to `hasConstructSlot`'s doc-comment. Base for the axis-1
> suite; axes 2–4 derive alongside. Amended 2026-06-25 — `isClass` throw-safety root-fix
> (its `prototype` descriptor read now routes through `getInertDescriptor`); surfaced by
> the `@/object` round, no behavioral verdict changed — see Resolved items #3.

## Module contract

`type-detection / function` discriminates callable values into a single conceptual
lattice. The floor is pure callability (`typeof === 'function'`); each layer above adds a
spec-derived guarantee — the verified Function-interface, newability, and the specific
species (ES3, class, async, generator, async-generator).

```
Callable                                  (isCallable)            — typeof === 'function' floor
  └── VerifiedFunction                    (isFunction)            — own call/apply/bind callable
        ├── NewableFunction               (isNewableFunction)     — + [[Construct]] (lenient gate)
        │     ├── ES3Function             (isES3Function)         — own WRITABLE prototype
        │     └── ClassConstructor        (isClass)               — own READONLY prototype
        │           ├── [class-syntax]    (isCustomClass)         — source startsWith 'class'
        │           └── [native]          (isBuiltInClass)        — source does NOT
        ├── AsyncFunction                 (isAsyncFunction)       — %AsyncFunction% intrinsic
        └── AnyGeneratorFunction          (isAnyGeneratorFunction)— union of the two below
              ├── GeneratorFunction       (isGeneratorFunction)       — %GeneratorFunction%
              └── AsyncGeneratorFunction  (isAsyncGeneratorFunction)  — %AsyncGeneratorFunction%
```

**The two-sides split (decisions #003, #005).** The lattice has a newable side and a
non-newable side, and the spec gives each a different discriminator:

- **Newable side** discriminates on _own-instance descriptors_ — the `writable` flag on
  the own `prototype` descriptor (`ES3Function` writable, `ClassConstructor` readonly).
- **Non-newable side** discriminates on _prototype-chain values_ — `Symbol.toStringTag`
  resolved through the chain, the resolved constructor name, and the proto-side own-key
  surface (`constructor` only for async; `constructor` + `prototype` for the generators).

**The bound-admission asymmetry (decision #005, policy-flagged Q.002).** `bind` strips a
function's own slots while preserving its `[[Prototype]]`. The newable side's
discriminators (own-prototype descriptors) are stripped, so the strict newable predicates
(`isES3Function`, `isClass`) **reject** bound variants for free. The non-newable side's
discriminators (prototype-chain tag + proto-surface) survive, so the species predicates
(`isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`) **admit** bound
variants for free. This asymmetry is forced by spec mechanics, not chosen; it is the
current SHIPPED behavior. Re-balancing it is a policy call (Q.002), not a spec change —
vectors that turn on it are tagged `[Q.002]` so a later flip is a findable diff.

## Surface inventory

**Public narrowing predicates (axis 1) — 11:** `isCallable`, `isFunction`,
`isNewableFunction`, `isES3Function`, `isClass`, `isCustomClass`, `isBuiltInClass`,
`isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`,
`isAnyGeneratorFunction`. All generic `<T = unknown>(value?: T): value is T & X` (#031).

**Public non-narrowing predicate (no `@internal` tag) — 1:**
`hasConstructSlot(value?): boolean` — the Proxy-`construct`-trap `[[Construct]]` probe.
Carries no `@internal` tag in either `.js` or `.d.ts` **by design**: it is a first-class
public export, not an internal helper, even though the newable predicates are built on top
of it. (Contrast `getFunctionSource`, which is `@internal`.) It is the package's
standalone `[[Construct]]`-presence probe — axis 1, returning a plain `boolean` rather
than narrowing.

**Exported `@internal` helpers (axis 4) — 9:**

- `getFunctionSource(value: Callable): string` — trimmed source via the realm-fixed
  `toFunctionString.call`; preserves `[native code]` markers. Precondition: `value` must
  be `Callable` (a non-callable receiver throws — see `gFS/B1`).
- Async family: `hasAsyncFunctionIdentitySignal`, `hasAsyncFunctionPrototypeSurface`,
  `hasAsyncFunctionShape`.
- Generator family: `hasGeneratorFunctionIdentitySignal`,
  `hasAsyncGeneratorFunctionIdentitySignal`, `hasAnyGeneratorFunctionPrototypeSurface`
  (family-shared — both generator species share one proto-surface check),
  `hasGeneratorFunctionShape`, `hasAsyncGeneratorFunctionShape`.

Exporting the shape/sub-helpers is what makes the cross-realm structural arm unit-testable
on **local** values (the helpers carry no same-realm `instanceof` fast-path — that lives
in the orchestrators — so they run the realm-independent logic directly, no `vm` realm
needed; ADR #015, #053).

**Exported types without a predicate (12):** `Callable`, `CallableOrNewable`,
`VerifiedFunction`, `ES3Function`, `ClassConstructor`, `NewableFunction`, `AsyncFunction`,
`Generator`, `AsyncGenerator`, `GeneratorFunction`, `AsyncGeneratorFunction`,
`AnyGeneratorFunction`.

Re-confirmation gate: 21 `.js` value exports = 21 `.d.ts` declarations; 12 type exports
match; `architecture/function.md` matches the code (no drift). The three captured
intrinsic constructors (`AsyncFunctionConstructor`, `GeneratorFunctionConstructor`,
`AsyncGeneratorFunctionConstructor`) are module-local `const`s, not exports — no #053
action.

## Cross-cutting vectors

Stated once, referenced per predicate.

- **CC/nullish** — `null`, `undefined`, omitted → rejected by all 11 narrowing predicates
  (the `isCallable` / `isFunction` gate).
- **CC/primitive** — `'x'`, `42`, `true`, `Symbol()` (the symbol _value_), `1n` → rejected
  (`typeof !== 'function'`).
- **CC/non-callable-object** — `{}`, `[]`, `new Date()`, `/re/`, `Object.create(null)` →
  rejected (`typeof !== 'function'`).

Note the constructor-vs-value distinction: `Symbol` and `BigInt` (the _functions_) are
callable (`typeof === 'function'`) and **carry a `[[Construct]]` slot**, so they pass the
whole newable chain through to `isBuiltInClass` (`hCS/A4`, `isClass/A3`). That
`new Symbol()` throws is orthogonal — newability is the _presence_ of `[[Construct]]`, not
whether invoking it returns. Any ES3 function can be authored to throw on `new` and still
be newable; `Symbol`/`BigInt` are factories by behavior but newable by structure, and the
predicate chain reports structure. `Symbol()` and `1n` (the _values_) are primitives
caught by CC/primitive.

---

## `isCallable`

`isCallable<T = unknown>(value?: T): value is T & Callable` —
`typeof value === 'function'`. Realm-independent (syntactic operator).

- `isCallable/A1` — `function f() {}`, `function () {}` → true.
- `isCallable/A2` — `() => {}`, `({ m() {} }).m` → true (arrow + concise method).
- `isCallable/A3` — `class C {}`, `Array`, `Map`, `Date` → true (class constructors carry
  `[[Call]]`, even though calling a class without `new` throws).
- `isCallable/A4` — `async function () {}`, `function* () {}`, `async function* () {}` →
  true (every species).
- `isCallable/A5` — `(function () {}).bind(null)`, `(class C {}).bind(null)` → true (bound
  forms remain callable).
- `isCallable/A6` — `Symbol`, `BigInt`, `Math.max`, `parseInt`, `Proxy` → true (built-in
  callables, newable or not).
- `isCallable/R1` — CC/nullish, CC/primitive, CC/non-callable-object → false.

**Cross-realm (axis 2):** trivially realm-safe — `typeof` is realm-independent, unlike
`instanceof Function`. **Spoof (axis 3):** none — a syntactic operator cannot be spoofed.
**Refuses to claim:** `[[Construct]]`, the `Function.prototype` method set, any specific
species, or that `[[Call]]` returns rather than throws (a class constructor's `[[Call]]`
throws).

---

## `isFunction`

`isFunction<T = unknown>(value?: T): value is T & VerifiedFunction` —
`isCallable(value) && isCallable(value.bind) && isCallable(value.call) && isCallable(value.apply)`.

- `isFunction/A1` — `function () {}`, `() => {}`, `({ m() {} }).m` → true.
- `isFunction/A2` — `class C {}`, `Array`, `Map` → true (classes inherit callable
  `call`/`apply`/`bind`).
- `isFunction/A3` — `async function () {}`, `function* () {}`, `async function* () {}`,
  and all `.bind(null)` variants → true.
- `isFunction/A4` — `Math.max`, `Symbol`, `Proxy` → true (built-ins inherit the three
  methods).
- `isFunction/R1` — `{ bind() {}, call() {}, apply() {} }` → false (not callable —
  `typeof !== 'function'`; the verified interface is gated by `isCallable` first).
- `isFunction/R2` — a function whose own `bind` is shadowed with a non-callable
  (`Object.defineProperty(fn, 'bind', { value: 123 })`) → false (the
  `isCallable(value.bind)` link fails).
- (plus CC vectors.)

**Refuses to claim:** strict _identity_ of the three methods — it is observational, not
nominal. `VerifiedFunction` promises something callable answers at `call`/`apply`/`bind`,
not that they are the genuine `Function.prototype.*` members. **Cross-realm (axis 2):**
realm-safe — reads observable callability of own/inherited members, no intrinsic identity.
**Spoof (axis 3):** the per-member `isCallable` checks close the shadowed-to-non-callable
spoof (`R2`); a member replaced with a _different callable_ is admitted by design (the
contract is observational). **Composition note (axis 4):** four `isCallable` calls.

---

## `hasConstructSlot`

`hasConstructSlot(value?: unknown): boolean` — builds `new Proxy(value, { construct })`
and attempts `new`; returns whether `[[Construct]]` is reachable. Non-narrowing (returns
`boolean`). See Open item #1 (classification).

- `hCS/A1` — `function () {}`, `class C {}` → true (both carry `[[Construct]]`).
- `hCS/A2` — `Array`, `Map`, `Date`, `Proxy` → true (built-in constructors).
- `hCS/A3` — `(function () {}).bind(null)`, `(class C {}).bind(null)` → true — `bind`
  preserves `[[Construct]]`. This is the basis of the bound-newable species. `[Q.002]`
- `hCS/A4` — `Symbol`, `BigInt` → **true** — both carry a `[[Construct]]` slot (the Proxy
  can wrap them with a `construct` trap, which only succeeds when the target genuinely has
  `[[Construct]]`). Their slot is _defined to throw_ on actual invocation, but the probe
  reports presence without invoking, and presence is what newability means. `new Symbol()`
  throwing is orthogonal behavior, not slot-absence. Contrast `hCS/R3`.
- `hCS/R1` — `() => {}`, `({ m() {} }).m` → false (arrows/methods have no
  `[[Construct]]`).
- `hCS/R2` — `async function () {}`, `function* () {}`, `async function* () {}` → false
  (no `[[Construct]]` in any non-newable species).
- `hCS/R3` — `Math.max`, `parseInt` → false — genuinely _no_ `[[Construct]]` slot (the
  Proxy cannot even wrap them as a constructor). This is the real discriminator from
  `hCS/A4`: `Symbol`/`BigInt` have a throwing slot; `Math.max` has none at all.
- `hCS/R4` — `{}`, `null`, `42` → false (a non-object Proxy target throws at Proxy
  construction → caught; a non-callable target has no `[[Construct]]`).

**Cross-realm (axis 2):** realm-safe — the Proxy probe reads the `[[Construct]]` internal
method, which is realm-independent. **Spoof (axis 3):** the MDN-cited invariant ("the
target used to initialize the proxy must itself be a valid constructor") makes this
unspoofable from the trap side — the `construct` trap only fires if the target genuinely
carries `[[Construct]]`. **Refuses to claim:** that `[[Construct]]` _returns_ rather than
_throws_ — it reports slot presence, not invocation outcome (`hCS/A4`).

---

## `isNewableFunction`

`isNewableFunction<T = unknown>(value?: T): value is T & NewableFunction` —
`isFunction(value) && hasConstructSlot(value)`. The lenient newable gate — admits all
three newable species.

- `isNewableFunction/A1` — `function () {}` → true (ES3).
- `isNewableFunction/A2` — `class C {}`, `Array`, `Map`, `Date` → true (class
  constructors).
- `isNewableFunction/A3` — `(function () {}).bind(null)`, `(class C {}).bind(null)` → true
  — the bound-newable third species; `[[Construct]]` survives `bind` even though the own
  `prototype` is gone. `[Q.002]`
- `isNewableFunction/A4` — `Symbol`, `BigInt` → true — both carry `[[Construct]]` (a
  throwing one; see `hCS/A4`), so they are newable by structure regardless of the throw.
- `isNewableFunction/R1` — `() => {}`, `({ m() {} }).m` → false (no `[[Construct]]`).
- `isNewableFunction/R2` — `async function () {}`, `function* () {}`,
  `async function* () {}` → false.
- `isNewableFunction/R3` — `Math.max`, `parseInt` → false (callable, genuinely no
  `[[Construct]]` slot — contrast `Symbol`/`BigInt` in `A4`).
- (plus CC vectors.)

**Refuses to claim:** any `prototype` guarantee — bound newables have none, so the gate
makes no prototype promise. Narrow to `isES3Function` / `isClass` to reach a `prototype`.
**Cross-realm (axis 2):** realm-safe (`isFunction` + Proxy probe, both realm-independent).
**Spoof (axis 3):** inherits `hasConstructSlot`'s unspoofable `[[Construct]]` probe.
**Composition note (axis 4):** `isFunction` → `hasConstructSlot`.

---

## `isES3Function`

`isES3Function<T = unknown>(value?: T): value is T & ES3Function` —
`isNewableFunction(value) && hasOwnWritablePrototype(value)`. The strict ES3 shape: a
newable with an own **writable** `prototype` descriptor.

- `isES3Function/A1` — `function f() {}`, `function () {}` → true.
- `isES3Function/R1` — `class C {}`, `Array`, `Map`, `Date` → false (own `prototype` is
  readonly — that is `isClass`).
- `isES3Function/R2` — `(function () {}).bind(null)` → false — bound ES3 lost its own
  `prototype` slot; still newable but no longer an ES3 shape. `[Q.002]`
- `isES3Function/R3` — `() => {}`, `({ m() {} }).m` → false (not newable).
- `isES3Function/R4` — `async function () {}`, `function* () {}`, `async function* () {}`
  → false.
- `isES3Function/R5` — `Symbol`, `BigInt` → false (newable, but readonly own `prototype` →
  class side, not ES3).
- (plus CC vectors.)

**Refuses to claim:** bound ES3 functions (no own `prototype` → no ES3 shape; the package
does not name the bound-newable species — Q.003). **Cross-realm (axis 2):** realm-safe —
the own-`prototype`-writable descriptor read is realm-independent. **Spoof (axis 3):** the
own-descriptor `writable === true` read is the spec-given discriminator; a value cannot
fake a writable own `prototype` while being a class (class `prototype` is non-writable by
spec). **Composition note (axis 4):** `isNewableFunction` → `hasOwnWritablePrototype`
(`@/utility`).

---

## `isClass`

`isClass<T = unknown>(value?: T): value is T & ClassConstructor` —
`isNewableFunction(value) && getInertDescriptor(value, 'prototype')?.writable === false`.
The strict class shape: a newable with an own **readonly** `prototype` descriptor. Covers
both custom (`class`-syntax) and built-in class constructors. The `prototype` descriptor
read routes through the throw-safe `getInertDescriptor` (amended 2026-06-25 — see Resolved
items #2), so a hostile constructor cannot make the read throw.

- `isClass/A1` — `class C {}`, `class Foo extends Array {}` → true (custom).
- `isClass/A2` — `Array`, `Map`, `Date`, `Number`, `Object` → true (built-in classes; own
  `prototype` is readonly).
- `isClass/A3` — `Symbol`, `BigInt` → **true** — newable (throwing `[[Construct]]`, see
  `hCS/A4`) with a readonly own `prototype`. By the package's structural definition (a
  class is a newable with a readonly own `prototype`), these qualify; the throw-on-`new`
  behavior is orthogonal to the structural classification. They resolve to
  `isBuiltInClass`.
- `isClass/R1` — `function () {}` → false (own `prototype` is writable — that is
  `isES3Function`).
- `isClass/R2` — `(class C {}).bind(null)` → false — bound class lost its own `prototype`
  slot; the descriptor read returns `undefined` and `undefined?.writable === false`
  short-circuits to `false`. `[Q.002]`
- `isClass/R3` — `() => {}`, `async function () {}`, `function* () {}` → false (not
  newable, or no own readonly `prototype`).
- `isClass/R4` — `Math.max`, `parseInt` → false (no `[[Construct]]` slot at all — not
  newable; contrast `Symbol`/`BigInt` in `A3`).
- `isClass/B1` — a `Proxy` (newable target) whose `getOwnPropertyDescriptor` trap throws →
  false, **not thrown** — the `prototype` descriptor read routes through the throw-safe
  `getInertDescriptor` (amended 2026-06-25, decision-aligned with #056). Exercised by the
  `@/object` cross-realm round (a hostile constructor reached through the plain-object
  contract walk); to be covered directly in the `function` round.
- (plus CC vectors.)

**Refuses to claim:** bound classes (own `prototype` stripped). **Cross-realm (axis 2):**
realm-safe — the own-`prototype`-readonly descriptor read is realm-independent; built-in
classes from a foreign realm still expose a readonly own `prototype`. **Spoof (axis 3):**
the `writable === false` own-descriptor read is the only spec-given class/ES3
discriminator; routed through the throw-safe `getInertDescriptor` so a hostile constructor
yields `false`, not a throw. **Composition note (axis 4):** `isNewableFunction` →
`getInertDescriptor` (`@/utility`).

---

## `isCustomClass`

`isCustomClass<T = unknown>(value?: T): value is T & ClassConstructor` —
`isClass(value) && getFunctionSource(value).startsWith('class')`.

- `isCustomClass/A1` — `class C {}`, `class Foo extends Array {}` → true (source starts
  with the `class` keyword).
- `isCustomClass/R1` — `Array`, `Map`, `Date`, `Number`, `Symbol`, `BigInt` → false
  (built-in source is `function Foo() { [native code] }`, not the `class` keyword).
- `isCustomClass/R2` — `(class C {}).bind(null)` → false (rejected upstream by `isClass`).
- `isCustomClass/R3` — `function () {}`, `() => {}` → false (fail `isClass`).
- (plus CC vectors.)

**Refuses to claim:** built-in classes (the disjoint dual). **Cross-realm (axis 2):**
realm-safe — `getFunctionSource` goes through the realm-fixed `toFunctionString.call`, and
the `class` source prefix is spec-defined (#013), realm-independent. **Spoof (axis 3):**
the source prefix is spec-defined and read through the realm-fixed capture, immune to
instance `toString` tampering; reconstructing a function whose source literally begins
`class` while being built-in is not achievable through the spec. **Composition note (axis
4):** `isClass` → `getFunctionSource`.

---

## `isBuiltInClass`

`isBuiltInClass<T = unknown>(value?: T): value is T & ClassConstructor` —
`isClass(value) && !getFunctionSource(value).startsWith('class')`. The dual of
`isCustomClass`; together they partition `isClass`.

- `isBuiltInClass/A1` — `Array`, `Map`, `Date`, `Number`, `Object`, `Error` → true
  (built-in source does not start with `class`).
- `isBuiltInClass/A2` — `Symbol`, `BigInt` → **true** — newable-by-structure built-in
  classes whose `[[Construct]]` throws on `new` (see `isClass/A3`). The factory behavior
  is orthogonal; structurally they are built-in class constructors.
- `isBuiltInClass/R1` — `class C {}`, `class Foo extends Array {}` → false (custom source
  starts with `class`).
- `isBuiltInClass/R2` — `(class C {}).bind(null)`, `Array.bind(null)` → false (rejected
  upstream by `isClass` — bound forms lost the own readonly `prototype`).
- `isBuiltInClass/R3` — `function () {}`, `Math.max` → false (fail `isClass`).
- (plus CC vectors.)

**Refuses to claim:** custom classes (the disjoint dual). **Cross-realm / spoof (axes 2,
3):** as `isCustomClass`, inverted. **Composition note (axis 4):** `isClass` →
`getFunctionSource`.

---

## `isAsyncFunction`

`isAsyncFunction<T = unknown>(value?: T): value is T & AsyncFunction` —
`isFunction(value) && (value instanceof %AsyncFunction% || hasAsyncFunctionShape(value))`.

- `isAsyncFunction/A1` — `async function () {}`, `async function name() {}` → true.
- `isAsyncFunction/A2` — `async () => {}`, `({ async m() {} }).m` → true (async arrow +
  async concise method — structurally identical to the others at runtime).
- `isAsyncFunction/A3` — `(async function () {}).bind(null)`,
  `(async () => {}).bind(null)` → true — bound async admitted; `bind` preserves the
  `[[Prototype]]` chain, so the tag and resolved constructor survive. `[Q.002]`
- `isAsyncFunction/A4` — a cross-realm async function (fixture) → true (structural arm;
  the shape logic is pinned in-realm by the helper specs below).
- `isAsyncFunction/R1` — `function () {}`, `() => {}`, `({ m() {} }).m` → false.
- `isAsyncFunction/R2` — `() => Promise.resolve()` → false — returns a Promise but is not
  tagged `AsyncFunction`; the species is the function's intrinsic, not its return value.
- `isAsyncFunction/R3` — `async function* () {}` → false — async-generator family
  (different intrinsic, different tag, own writable `prototype`); the shared "Async"
  prefix names what the iterator yields, not the function.
- `isAsyncFunction/R4` — `class C {}`, `function* () {}` → false.
- (plus CC vectors.)

**Refuses to claim:** the four async source-forms apart (decl / expr / arrow / concise) —
structurally identical; distinguishing them is introspection (Q.003). **Cross-realm (axis
2):** admits foreign-realm async functions via `hasAsyncFunctionShape` (the `instanceof`
fast path fails cross-realm; the structural arm carries it). **Spoof (axis 3):** the
identity signal (tag + constructor name) rejects single-label tampering; the proto-surface
cross-validator rejects a value that spoofs `Symbol.toStringTag` but leaves its
`[[Prototype]]` unmodified. Coordinated tag+proto tampering passes here, but `instanceof`
accepts such a value too, so both code paths stay consistent. **Composition note (axis
4):** `isFunction` gate → same-realm `instanceof %AsyncFunction%` →
`hasAsyncFunctionShape` (→ `hasAsyncFunctionIdentitySignal` +
`hasAsyncFunctionPrototypeSurface`).

---

## `isGeneratorFunction`

`isGeneratorFunction<T = unknown>(value?: T): value is T & GeneratorFunction` —
`isFunction(value) && (value instanceof %GeneratorFunction% || hasGeneratorFunctionShape(value))`.

- `isGeneratorFunction/A1` — `function* () {}`, `function* name() {}` → true.
- `isGeneratorFunction/A2` — `({ *m() {} }).m` (concise generator method) → true.
- `isGeneratorFunction/A3` — `(function* () {}).bind(null)` → true — bound sync generator
  admitted; `bind` preserves the chain. `[Q.002]`
- `isGeneratorFunction/A4` — a cross-realm sync generator function (fixture) → true
  (structural arm).
- `isGeneratorFunction/R1` — `async function* () {}` → false (async-generator family;
  different intrinsic + tag).
- `isGeneratorFunction/R2` — `async function () {}`, `function () {}`, `() => {}` → false.
- `isGeneratorFunction/R3` — `class C {}`, `Array` → false.
- (plus CC vectors.)

**Cross-realm (axis 2):** admits foreign-realm sync generator functions via
`hasGeneratorFunctionShape`. **Spoof (axis 3):** tag + constructor-name identity signal
plus the family-shared proto-surface (`constructor` + `prototype` both present) cross-
validator. **Composition note (axis 4):** `isFunction` → `instanceof %GeneratorFunction%`
→ `hasGeneratorFunctionShape` (→ `hasGeneratorFunctionIdentitySignal` +
`hasAnyGeneratorFunctionPrototypeSurface`).

---

## `isAsyncGeneratorFunction`

`isAsyncGeneratorFunction<T = unknown>(value?: T): value is T & AsyncGeneratorFunction` —
`isFunction(value) && (value instanceof %AsyncGeneratorFunction% || hasAsyncGeneratorFunctionShape(value))`.

- `isAsyncGeneratorFunction/A1` — `async function* () {}`, `async function* name() {}` →
  true.
- `isAsyncGeneratorFunction/A2` — `({ async *m() {} }).m` (async concise generator method)
  → true.
- `isAsyncGeneratorFunction/A3` — `(async function* () {}).bind(null)` → true — bound
  async generator admitted. `[Q.002]`
- `isAsyncGeneratorFunction/A4` — a cross-realm async generator function (fixture) → true
  (structural arm).
- `isAsyncGeneratorFunction/R1` — `function* () {}` → false (sync-generator family).
- `isAsyncGeneratorFunction/R2` — `async function () {}` → false (async-function family —
  different intrinsic, no own `prototype`).
- `isAsyncGeneratorFunction/R3` — `function () {}`, `() => {}`, `class C {}` → false.
- (plus CC vectors.)

**Cross-realm (axis 2):** admits foreign-realm async generator functions via
`hasAsyncGeneratorFunctionShape`. **Spoof (axis 3):** as the sync generator, with the
`AsyncGeneratorFunction` tag as the per-species discriminator over the shared
proto-surface. **Composition note (axis 4):** `isFunction` →
`instanceof %AsyncGeneratorFunction%` → `hasAsyncGeneratorFunctionShape` (→
`hasAsyncGeneratorFunctionIdentitySignal` + `hasAnyGeneratorFunctionPrototypeSurface`).

---

## `isAnyGeneratorFunction`

`isAnyGeneratorFunction<T = unknown>(value?: T): value is T & AnyGeneratorFunction` — one
shared `isFunction` gate, then four inlined disjuncts: `instanceof %GeneratorFunction%`,
`instanceof %AsyncGeneratorFunction%`, `hasGeneratorFunctionShape`, or
`hasAsyncGeneratorFunctionShape`. There is no `hasAnyGeneratorFunctionShape` helper — the
inlined union is the codified pattern (composing the orchestrators would double-gate).

- `isAnyGeneratorFunction/A1` — `function* () {}` → true (sync).
- `isAnyGeneratorFunction/A2` — `async function* () {}` → true (async).
- `isAnyGeneratorFunction/A3` — `(function* () {}).bind(null)`,
  `(async function* () {}).bind(null)` → true (bound forms of either species). `[Q.002]`
- `isAnyGeneratorFunction/A4` — cross-realm sync or async generator (fixture) → true.
- `isAnyGeneratorFunction/R1` — `async function () {}` → false (async-function family).
- `isAnyGeneratorFunction/R2` — `function () {}`, `() => {}`, `class C {}` → false.
- (plus CC vectors.)

**Refuses to claim:** which of the two species — narrow with `isGeneratorFunction` /
`isAsyncGeneratorFunction` before calling, since the call-result types differ (`Generator`
vs. `AsyncGenerator`). **Cross-realm / spoof (axes 2, 3):** inherits from the two species
predicates it unions. **Composition note (axis 4):** the inlined four-disjunct union over
both shape helpers and both fast paths.

---

## Helper specification (axis 4)

### `getFunctionSource(value: Callable)` — `@internal`

`toFunctionString.call(value).trim()`.

- `gFS/A1` — `function f() {}` → a string starting `'function'`.
- `gFS/A2` — `class C {}` → a string starting `'class'` (the `isCustomClass` basis).
- `gFS/A3` — `Array`, `Math.max` → a string containing `'[native code]'` (markers
  preserved — the load-bearing native-vs-authored tell).
- `gFS/A4` — a function whose instance `toString` is deleted/replaced → still its real
  source (read goes through the realm-fixed capture, not the instance method).
- `gFS/B1` — a non-callable receiver (`null`, `{}`) → **throws** (precondition: typed
  `Callable`; `toFunctionString.call` throws on a non-callable `this`). Callers gate with
  `isClass` upstream, so the throw is unreachable in production paths.

### `hasAsyncFunctionIdentitySignal(value)` — `@internal`

`getTypeSignature(value) === '[object AsyncFunction]' && getDefinedConstructorName(value) === 'AsyncFunction'`.

- `hAFIS/A1` — `async function () {}`, `async () => {}`,
  `(async function () {}).bind(null)` → true (tag + name both `AsyncFunction`; survive
  `bind`).
- `hAFIS/R1` — `function () {}` (tag `'[object Function]'`), `function* () {}`,
  `async function* () {}` → false (wrong tag/name).
- `hAFIS/R2` — `null`, `{}` → false (tag is `'[object Null]'` / `'[object Object]'`).

### `hasAsyncFunctionPrototypeSurface(value)` — `@internal`

`new Set(getInertOwnPropertyNames(getInertPrototypeOf(value)))` has `'constructor'` and
**not** `'prototype'`.

- `hAFPS/A1` — `async function () {}`, `async () => {}` → true
  (`%AsyncFunction.prototype%` own keys: `constructor`, no `prototype`).
- `hAFPS/A2` — `function () {}`, `() => {}` → **true** — their `[[Prototype]]` is
  `%Function.prototype%`, whose own keys include `'constructor'` but **not**
  `'prototype'`. The proto-surface check alone does not separate plain functions from
  async; the full `hasAsyncFunctionShape` gates with the identity signal first. (Pin this
  — it is a surprising standalone-helper result the decidability run must confirm.)
- `hAFPS/R1` — `function* () {}`, `async function* () {}` → false (generator proto carries
  an own `'prototype'` key → `!has('prototype')` fails).

### `hasGeneratorFunctionIdentitySignal(value)` — `@internal`

`getTypeSignature(value) === '[object GeneratorFunction]' && getDefinedConstructorName(value) === 'GeneratorFunction'`.

- `hGFIS/A1` — `function* () {}`, `(function* () {}).bind(null)` → true.
- `hGFIS/R1` — `async function* () {}` (tag `AsyncGeneratorFunction`), `function () {}`,
  `async function () {}` → false.

### `hasAsyncGeneratorFunctionIdentitySignal(value)` — `@internal`

`getTypeSignature(value) === '[object AsyncGeneratorFunction]' && getDefinedConstructorName(value) === 'AsyncGeneratorFunction'`.

- `hAGFIS/A1` — `async function* () {}`, `(async function* () {}).bind(null)` → true.
- `hAGFIS/R1` — `function* () {}` (tag `GeneratorFunction`), `async function () {}` →
  false.

### `hasAnyGeneratorFunctionPrototypeSurface(value)` — `@internal` (family-shared)

`new Set(getInertOwnPropertyNames(getInertPrototypeOf(value)))` has **both**
`'constructor'` and `'prototype'`.

- `hAGFPS/A1` — `function* () {}`, `async function* () {}` → true (both generator protos
  carry `constructor` + `prototype`).
- `hAGFPS/R1` — `async function () {}` → false (`%AsyncFunction.prototype%` lacks own
  `'prototype'`).
- `hAGFPS/R2` — `function () {}`, `() => {}` → false (`%Function.prototype%` lacks own
  `'prototype'`). This is the structural discriminator the async-family proto-surface
  inverts.

### `hasAsyncFunctionShape(value?)` — `@internal` (cross-realm structural arm; runs on local values)

`!hasOwnPrototype(value) && !hasConstructSlot(value) && hasAsyncFunctionIdentitySignal(value) && hasAsyncFunctionPrototypeSurface(value)`.

- `hAFShape/A1` — `async function () {}`, `async () => {}`, `({ async m() {} }).m` → true.
- `hAFShape/A2` — `(async function () {}).bind(null)` → true (no own `prototype`, no
  `[[Construct]]`, tag + proto-surface inherited). `[Q.002]`
- `hAFShape/R1` — `function () {}` → false (has own `prototype` → `!hasOwnPrototype`
  fails; also has `[[Construct]]`).
- `hAFShape/R2` — `async function* () {}` → false (has own writable `prototype`; tag
  mismatch).
- `hAFShape/R3` — `() => {}`, `function* () {}` → false (tag mismatch at the identity
  signal).
- `hAFShape/R4` — `null`, `{}`, `42` → false (non-callables flow through and fail the
  identity signal).

### `hasGeneratorFunctionShape(value?)` — `@internal`

`!hasConstructSlot(value) && hasGeneratorFunctionIdentitySignal(value) && hasAnyGeneratorFunctionPrototypeSurface(value)`.

- `hGFShape/A1` — `function* () {}`, `({ *m() {} }).m` → true.
- `hGFShape/A2` — `(function* () {}).bind(null)` → true — no `!hasOwnPrototype`
  self-check, so bound (no own prototype) and unbound (own writable prototype) both admit.
  `[Q.002]`
- `hGFShape/R1` — `async function* () {}` → false (tag mismatch).
- `hGFShape/R2` — `function () {}` → false (`hasConstructSlot` true → `!hasConstructSlot`
  fails).
- `hGFShape/R3` — `async function () {}`, `() => {}` → false (tag mismatch / proto-surface
  lacks `prototype`).
- `hGFShape/R4` — `null`, `{}` → false.

### `hasAsyncGeneratorFunctionShape(value?)` — `@internal`

`!hasConstructSlot(value) && hasAsyncGeneratorFunctionIdentitySignal(value) && hasAnyGeneratorFunctionPrototypeSurface(value)`.

- `hAGFShape/A1` — `async function* () {}`, `({ async *m() {} }).m` → true.
- `hAGFShape/A2` — `(async function* () {}).bind(null)` → true (same self-check omission).
  `[Q.002]`
- `hAGFShape/R1` — `function* () {}` → false (tag mismatch).
- `hAGFShape/R2` — `function () {}`, `async function () {}`, `() => {}` → false.
- `hAGFShape/R3` — `null`, `{}` → false.

---

## Resolved items

1. **`Symbol` / `BigInt` classify as built-in classes — RESOLVED (impl is correct).** The
   decidability run surfaced that `hasConstructSlot`, `isNewableFunction`, `isClass`, and
   `isBuiltInClass` all admit `Symbol` and `BigInt`. Ground truth: both carry a
   `[[Construct]]` internal method (a Proxy `construct`-trap can wrap them — that only
   succeeds for a genuine constructor — while `Math.max` and arrows cannot be wrapped)
   plus a readonly own `prototype`. The slot is _defined to throw_ on invocation
   (`new Symbol()` → `TypeError`), but the design owner's ruling is that **newability is
   the presence of a `[[Construct]]` slot, orthogonal to whether invoking it returns or
   throws.** Any ES3 function can be authored to throw on `new` and remain newable;
   `Symbol`/`BigInt` are factories by behavior but newable by structure, and the predicate
   chain reports structure, not invocation outcome. So the implementation is correct as
   written; the spec vectors were drafted from a stale assumption and have been corrected
   to admit them (`hCS/A4`, `isNewableFunction/A4`, `isClass/A3`, `isBuiltInClass/A2`). No
   code change.

   Reconciliation with ADR #0049: that decision's "factory functions are not constructors"
   line is scoped to the `primitive` module's question — whether `instanceof Symbol` is a
   meaningful _identity_ probe for the boxed predicates (it is not, since
   `Function.prototype[@@hasInstance]` walks the chain regardless of `new`-callability).
   That remains valid. It does not speak to whether `Symbol` carries a `[[Construct]]`
   slot, which is the orthogonal question the `function` module answers. No edit to #0049
   (append-only).

2. **`hasConstructSlot` is intentionally public — SETTLED.** Unlike `getFunctionSource`
   (`@internal`), `hasConstructSlot` carries no `@internal` tag in either `.js` or `.d.ts`
   **by design**: the design owner confirmed it is a first-class public export — the
   package's standalone `[[Construct]]`-presence probe — not an internal helper, even
   though the newable predicates are built on top of it. It is therefore an axis-1 surface
   member (a non-narrowing public predicate returning `boolean`), specced above alongside
   the narrowing predicates. No `@internal` tag is to be added.

3. **`isClass` throw-safety (impl change, 2026-06-25) — RESOLVED.** Surfaced by the
   `@/object` cross-realm test round: `isClass` did its own raw
   `getOwnPropertyDescriptor(value, 'prototype')`, so a hostile constructor (a `Proxy`
   whose `getOwnPropertyDescriptor` trap throws) made `isClass` — and therefore every
   consumer, notably the `@/object` plain-object contract — **throw** rather than answer a
   boolean. The design owner green-lit the cross-module root-fix: route the read through
   the throw-safe `getInertDescriptor` (#056), so a hostile trap yields `undefined` (→
   `false`). Behavior unchanged for all legit inputs (own `prototype` is found at level 0
   of the walk); `isClass/B1` added above. **Finding deferred to the `function` round:**
   the sibling `@/utility` helpers `hasOwnPrototype` / `hasOwnWritablePrototype` (feeding
   `isES3Function` etc.) carry the same raw-`getOwnPropertyDescriptor` surface and want
   the same treatment. Decision-aligned with #056/#029 (no new ADR).

## Open items

None.

## Policy flags

- **Q.002 — bound-admission asymmetry.** All `[Q.002]`-tagged vectors encode the current
  SHIPPED behavior: the strict newable predicates (`isES3Function`, `isClass`) reject
  bound variants; the species predicates (`isAsyncFunction`, `isGeneratorFunction`,
  `isAsyncGeneratorFunction`, `isAnyGeneratorFunction`) and `isNewableFunction` /
  `hasConstructSlot` admit them. Re-balancing is the design owner's call; the tags make a
  later flip a findable diff.
- **Q.003 — introspection-tier discriminations.** Two distinctions the structural schema
  deliberately cannot resolve and that no predicate here claims: arrow vs. concise method
  (descriptor-identical; `[[HomeObject]]` is the only tell), and bound vs. unbound within
  the arrow/concise and species rows. Both belong to `@species-js/function-introspection`.
  Recorded as boundaries, not gaps.
