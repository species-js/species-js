# function — behavioral specification

> Spec format and the multi-axis model are defined in [`./README.md`](./README.md).
> Vectors are reasoned from the canon (`function.d.ts`, `function.js`,
> `architecture/function.md`, decisions #003–#007, #009–#016, #019, #031, #049, #073,
> #076, #080, #081). Status: **FROZEN 2026-06-19** — decidability check passed (45 suites
> over all 11 public predicates + `hasConstructSlot` + the 9 exported `@internal` helpers,
> via the `#index` barrel, single realm). The run surfaced that `Symbol`/`BigInt` classify
> as built-in classes (they carry a throwing `[[Construct]]` slot); the design owner ruled
> the implementation correct — newability is slot presence, orthogonal to throw-on-`new` —
> and the spec vectors were corrected to admit them (see Resolved items #1). One neutral
> clarifying note was added to `hasConstructSlot`'s doc-comment. Base for the axis-1
> suite; axes 2–4 derive alongside. Amended 2026-06-25 — `isClass` throw-safety root-fix
> (its `prototype` descriptor read now routes through `getNextAvailableSafeDescriptor`);
> surfaced by the `#object` round, no behavioral verdict changed — see Resolved items #3.
>
> **AMENDED 2026-07-28 — re-decidability RESOLVED 2026-07-28 (see the RE-DECIDED note
> below).** Reconciled with three hardening waves the freeze predates: the realm
> decomposition (ADR #080 — the three `has*Shape` structural arms renamed to
> `isAlienRealm*`, three `isCurrentRealm*Instance` same-realm arms added), the
> throw-safety model (ADRs #073/#076 — `getFunctionSource` and the `hasOwn*` trio wrapped,
> `isFunction` wrapped, 24 `@@throw-safe` markers), and the Q.002 closure (ADR #081). The
> `@internal` helper surface grew 9 → 12; `isFunction` gained a throw-safety guarantee and
> `getFunctionSource`'s `gFS/B1` flipped from _throws_ → `undefined`. The 45-suite
> decidability guarantee predates these deltas — the re-run is owed to the function test
> round. See Resolved items #4–#6 and Open items #1.
>
> **RE-DECIDED 2026-07-28 — function test round complete.** The six-file suite (`spec` /
> `cross-realm` / `adversarial` / `throw-safety` / `_internal/helpers`, 375 assertions,
> driven through the `#index` barrel over a single realm plus a `vm` foreign realm) re-ran
> the decidability check across all 12 public predicates and the 12 `@internal` helpers
> and confirmed every amended vector — including the standalone-arm surprises flagged for
> this run: `hAFPS/A2` (a plain function's proto-surface passes the async check),
> `iCR<Species>FI/B1` (a get-trap `Proxy` isolates to `true` on the same-realm arm while
> the orchestrator returns `false` via the `isFunction` gate), and the `gFS/B1` /
> `isFunction/B1` / `isClass/B1` absorbed-hostile sentinels. Open item #1 (the axis-5
> `hostile × marked-export` matrix) is now authored and green — the 24 `@@throw-safe`
> markers are verified for non-propagation and cross-checked against the markers parsed
> from `src/function.js`. The freeze's decidability guarantee is restored.

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

**The bound-admission asymmetry (decisions #005, #081).** `bind` strips a function's own
slots while preserving its `[[Prototype]]`. The newable side's discriminators
(own-prototype descriptors) are stripped, so the strict newable predicates
(`isES3Function`, `isClass`) **reject** bound variants for free. The non-newable side's
discriminators (prototype-chain tag + proto-surface) survive, so the species predicates
(`isAsyncFunction`, `isGeneratorFunction`, `isAsyncGeneratorFunction`) **admit** bound
variants for free. No predicate reads a bound-specific tell: the asymmetry is the free
residue of each predicate's spec-invariant discriminator. **SETTLED (Q.002 closed by
#081):** bound detection is cheap (`name.startsWith('bound ')`, #009) but that tell is
spoofable, hence unreliable — so a reliability-first type-detection library declines it,
and the species predicates admit bound because refusing would require importing that
unreliable signal, which belongs to introspection (`isBoundFunction`, Q.003). Vectors that
turn on the asymmetry stay tagged `[Q.002]` as findable cross-refs to the settled
decision.

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

**Exported `@internal` helpers (axis 4) — 12:**

- `getFunctionSource(value: Callable): string | undefined` — trimmed source via the
  realm-fixed `toFunctionString.call`, wrapped in `try`/`catch`; preserves `[native code]`
  markers. Throw-safe: a non-callable receiver yields `undefined` rather than throwing
  (see `gFS/B1`).
- Async family: `hasAsyncFunctionIdentitySignal`, `hasAsyncFunctionPrototypeSurface`,
  `isAlienRealmAsyncFunction` (the cross-realm structural arm; was
  `hasAsyncFunctionShape`), `isCurrentRealmAsyncFunctionInstance` (the same-realm
  `instanceof` arm).
- Generator family: `hasGeneratorFunctionIdentitySignal`,
  `hasAsyncGeneratorFunctionIdentitySignal`, `hasAnyGeneratorFunctionPrototypeSurface`
  (family-shared — both generator species share one proto-surface check),
  `isAlienRealmGeneratorFunction` / `isAlienRealmAsyncGeneratorFunction` (the cross-realm
  structural arms; were `has{,Async}GeneratorFunctionShape`),
  `isCurrentRealmGeneratorFunctionInstance` /
  `isCurrentRealmAsyncGeneratorFunctionInstance` (the same-realm `instanceof` arms).

Exporting the realm arms and sub-helpers makes both realm paths unit-testable on **local**
values: the `isCurrentRealm*Instance` arms exercise the same-realm `instanceof` against
the captured intrinsic, and the `isAlienRealm*` arms + sub-helpers run the
realm-independent structural logic directly — no `vm` realm needed (ADR #015, #053, #080).
Per #080 every realm arm is a generic guard (`value is T & X`), not a plain `boolean`.

**Exported types without a predicate (12):** `Callable`, `CallableOrNewable`,
`VerifiedFunction`, `ES3Function`, `ClassConstructor`, `NewableFunction`, `AsyncFunction`,
`Generator`, `AsyncGenerator`, `GeneratorFunction`, `AsyncGeneratorFunction`,
`AnyGeneratorFunction`.

Re-confirmation gate: 24 `.js` value exports = 24 `.d.ts` declarations (21 + the three
`isCurrentRealm*Instance` arms, #080); 12 type exports match; `architecture/function.md`
matches the code (no drift). The three captured intrinsic constructors
(`AsyncFunctionConstructor`, `GeneratorFunctionConstructor`,
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
`isCallable(value) && isCallable(value.bind) && isCallable(value.call) && isCallable(value.apply)`,
the whole chain wrapped in `try`/`catch` → throw-safe (`@@throw-safe`, #073/#076).

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
- `isFunction/B1` — a callable `Proxy` whose `get` trap throws
  (`new Proxy(() => {}, { get() { throw new Error(); } })`) → **false, not thrown**.
  `typeof` admits the Proxy (`isCallable` true), then reading `.bind` fires the trap; the
  `try`/`catch` wrap absorbs it → `false`. This is the guarantee every downstream
  predicate's `@@throw-safe` marker rests on (added post-freeze; #073/#076).
- (plus CC vectors.)

**Refuses to claim:** strict _identity_ of the three methods — it is observational, not
nominal. `VerifiedFunction` promises something callable answers at `call`/`apply`/`bind`,
not that they are the genuine `Function.prototype.*` members. **Cross-realm (axis 2):**
realm-safe — reads observable callability of own/inherited members, no intrinsic identity.
**Spoof (axis 3):** the per-member `isCallable` checks close the shadowed-to-non-callable
spoof (`R2`); a member replaced with a _different callable_ is admitted by design (the
contract is observational). **Composition note (axis 4):** four `isCallable` calls,
wrapped in `try`/`catch` (throw-safe).

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
(`#utility`).

---

## `isClass`

`isClass<T = unknown>(value?: T): value is T & ClassConstructor` —
`isNewableFunction(value) && hasOwnNonWritablePrototype(value)`. The strict class shape: a
newable with an own **readonly** `prototype` descriptor. Covers both custom
(`class`-syntax) and built-in class constructors. The `prototype` descriptor read routes
through the throw-safe `hasOwnNonWritablePrototype` (`#utility`; wraps
`getNextAvailableSafeDescriptor`, #073), so a hostile constructor cannot make the read
throw — see Resolved items #3.

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
  slot, so `hasOwnNonWritablePrototype` finds no own `prototype` descriptor and returns
  `false`. `[Q.002]`
- `isClass/R3` — `() => {}`, `async function () {}`, `function* () {}` → false (not
  newable, or no own readonly `prototype`).
- `isClass/R4` — `Math.max`, `parseInt` → false (no `[[Construct]]` slot at all — not
  newable; contrast `Symbol`/`BigInt` in `A3`).
- `isClass/B1` — a `Proxy` (newable target) whose `getOwnPropertyDescriptor` trap throws →
  false, **not thrown** — the `prototype` descriptor read routes through the throw-safe
  `hasOwnNonWritablePrototype` (#073, wrapping `getNextAvailableSafeDescriptor` #056).
  Exercised by the `#object` cross-realm round (a hostile constructor reached through the
  plain-object contract walk); to be covered directly in the `function` round.
- (plus CC vectors.)

**Refuses to claim:** bound classes (own `prototype` stripped). **Cross-realm (axis 2):**
realm-safe — the own-`prototype`-readonly descriptor read is realm-independent; built-in
classes from a foreign realm still expose a readonly own `prototype`. **Spoof (axis 3):**
the `writable === false` own-descriptor read is the only spec-given class/ES3
discriminator; routed through the throw-safe `hasOwnNonWritablePrototype` so a hostile
constructor yields `false`, not a throw. **Composition note (axis 4):**
`isNewableFunction` → `hasOwnNonWritablePrototype` (`#utility`).

---

## `isCustomClass`

`isCustomClass<T = unknown>(value?: T): value is T & ClassConstructor` —
`isClass(value) && (getFunctionSource(value) ?? '').startsWith('class')`.

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
`isClass(value) && !(getFunctionSource(value) ?? '').startsWith('class')`. The dual of
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
`isFunction(value) && (isCurrentRealmAsyncFunctionInstance(value) || isAlienRealmAsyncFunction(value))`.

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
2):** admits foreign-realm async functions via `isAlienRealmAsyncFunction` (the same-realm
`isCurrentRealmAsyncFunctionInstance` fails cross-realm; the structural arm carries it).
**Spoof (axis 3):** the identity signal (tag + constructor name) rejects single-label
tampering; the proto-surface cross-validator rejects a value that spoofs
`Symbol.toStringTag` but leaves its `[[Prototype]]` unmodified. Coordinated tag+proto
tampering passes here, but `instanceof` accepts such a value too, so both code paths stay
consistent. **Composition note (axis 4):** `isFunction` gate →
`isCurrentRealmAsyncFunctionInstance` (same-realm `instanceof`) →
`isAlienRealmAsyncFunction` (→ `hasAsyncFunctionIdentitySignal` +
`hasAsyncFunctionPrototypeSurface`).

---

## `isGeneratorFunction`

`isGeneratorFunction<T = unknown>(value?: T): value is T & GeneratorFunction` —
`isFunction(value) && (isCurrentRealmGeneratorFunctionInstance(value) || isAlienRealmGeneratorFunction(value))`.

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
`isAlienRealmGeneratorFunction`. **Spoof (axis 3):** tag + constructor-name identity
signal plus the family-shared proto-surface (`constructor` + `prototype` both present)
cross- validator. **Composition note (axis 4):** `isFunction` →
`isCurrentRealmGeneratorFunctionInstance` (same-realm `instanceof`) →
`isAlienRealmGeneratorFunction` (→ `hasGeneratorFunctionIdentitySignal` +
`hasAnyGeneratorFunctionPrototypeSurface`).

---

## `isAsyncGeneratorFunction`

`isAsyncGeneratorFunction<T = unknown>(value?: T): value is T & AsyncGeneratorFunction` —
`isFunction(value) && (isCurrentRealmAsyncGeneratorFunctionInstance(value) || isAlienRealmAsyncGeneratorFunction(value))`.

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
`isAlienRealmAsyncGeneratorFunction`. **Spoof (axis 3):** as the sync generator, with the
`AsyncGeneratorFunction` tag as the per-species discriminator over the shared
proto-surface. **Composition note (axis 4):** `isFunction` →
`isCurrentRealmAsyncGeneratorFunctionInstance` (same-realm `instanceof`) →
`isAlienRealmAsyncGeneratorFunction` (→ `hasAsyncGeneratorFunctionIdentitySignal` +
`hasAnyGeneratorFunctionPrototypeSurface`).

---

## `isAnyGeneratorFunction`

`isAnyGeneratorFunction<T = unknown>(value?: T): value is T & AnyGeneratorFunction` — one
shared `isFunction` gate, then four inlined disjuncts:
`isCurrentRealmGeneratorFunctionInstance`, `isCurrentRealmAsyncGeneratorFunctionInstance`,
`isAlienRealmGeneratorFunction`, or `isAlienRealmAsyncGeneratorFunction`. There is no
`isAnyGeneratorFunction*` arm — the inlined union is the codified pattern (composing the
orchestrators would double-gate).

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
both same-realm arms (`isCurrentRealm{Generator,AsyncGenerator}FunctionInstance`) and both
alien-realm arms (`isAlienRealm{Generator,AsyncGenerator}Function`).

---

## Helper specification (axis 4)

### `getFunctionSource(value: Callable): string | undefined` — `@internal`

`try { toFunctionString.call(value).trim() } catch { undefined }` — throw-safe
(`@@throw-safe`, #073).

- `gFS/A1` — `function f() {}` → a string starting `'function'`.
- `gFS/A2` — `class C {}` → a string starting `'class'` (the `isCustomClass` basis).
- `gFS/A3` — `Array`, `Math.max` → a string containing `'[native code]'` (markers
  preserved — the load-bearing native-vs-authored tell).
- `gFS/A4` — a function whose instance `toString` is deleted/replaced → still its real
  source (read goes through the realm-fixed capture, not the instance method).
- `gFS/B1` — a non-callable receiver (`null`, `{}`) → **`undefined`, not thrown**
  (throw-safe; the `try`/`catch` wrap absorbs the non-callable-`this` `TypeError`).
  Callers still gate with `isClass` upstream, so this path is unreachable in production
  anyway. **Flipped from _throws_ post-freeze (#073) — the reason the return type widened
  `string` → `string | undefined`.**

### `hasAsyncFunctionIdentitySignal(value)` — `@internal`

`getTypeSignature(value) === '[object AsyncFunction]' && getDefinedConstructorName(value) === 'AsyncFunction'`.

- `hAFIS/A1` — `async function () {}`, `async () => {}`,
  `(async function () {}).bind(null)` → true (tag + name both `AsyncFunction`; survive
  `bind`).
- `hAFIS/R1` — `function () {}` (tag `'[object Function]'`), `function* () {}`,
  `async function* () {}` → false (wrong tag/name).
- `hAFIS/R2` — `null`, `{}` → false (tag is `'[object Null]'` / `'[object Object]'`).

### `hasAsyncFunctionPrototypeSurface(value)` — `@internal`

`new Set(getSafeOwnPropertyNames(getSafePrototypeOf(value)))` has `'constructor'` and
**not** `'prototype'`.

- `hAFPS/A1` — `async function () {}`, `async () => {}` → true
  (`%AsyncFunction.prototype%` own keys: `constructor`, no `prototype`).
- `hAFPS/A2` — `function () {}`, `() => {}` → **true** — their `[[Prototype]]` is
  `%Function.prototype%`, whose own keys include `'constructor'` but **not**
  `'prototype'`. The proto-surface check alone does not separate plain functions from
  async; the full `isAlienRealmAsyncFunction` gates with the identity signal first. (Pin
  this — it is a surprising standalone-helper result the decidability run must confirm.)
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

`new Set(getSafeOwnPropertyNames(getSafePrototypeOf(value)))` has **both** `'constructor'`
and `'prototype'`.

- `hAGFPS/A1` — `function* () {}`, `async function* () {}` → true (both generator protos
  carry `constructor` + `prototype`).
- `hAGFPS/R1` — `async function () {}` → false (`%AsyncFunction.prototype%` lacks own
  `'prototype'`).
- `hAGFPS/R2` — `function () {}`, `() => {}` → false (`%Function.prototype%` lacks own
  `'prototype'`). This is the structural discriminator the async-family proto-surface
  inverts.

### `isAlienRealmAsyncFunction(value?)` — `@internal` (cross-realm structural arm; runs on local values)

`!hasOwnPrototype(value) && !hasConstructSlot(value) && hasAsyncFunctionIdentitySignal(value) && hasAsyncFunctionPrototypeSurface(value)`.
Was `hasAsyncFunctionShape` (renamed #080); now narrows `value is T & AsyncFunction`.

- `iARAF/A1` — `async function () {}`, `async () => {}`, `({ async m() {} }).m` → true.
- `iARAF/A2` — `(async function () {}).bind(null)` → true (no own `prototype`, no
  `[[Construct]]`, tag + proto-surface inherited). `[Q.002]`
- `iARAF/R1` — `function () {}` → false (has own `prototype` → `!hasOwnPrototype` fails;
  also has `[[Construct]]`).
- `iARAF/R2` — `async function* () {}` → false (has own writable `prototype`; tag
  mismatch).
- `iARAF/R3` — `() => {}`, `function* () {}` → false (tag mismatch at the identity
  signal).
- `iARAF/R4` — `null`, `{}`, `42` → false (non-callables flow through and fail the
  identity signal).

### `isAlienRealmGeneratorFunction(value?)` — `@internal`

`!hasConstructSlot(value) && hasGeneratorFunctionIdentitySignal(value) && hasAnyGeneratorFunctionPrototypeSurface(value)`.
Was `hasGeneratorFunctionShape` (renamed #080); now narrows
`value is T & GeneratorFunction`.

- `iARGF/A1` — `function* () {}`, `({ *m() {} }).m` → true.
- `iARGF/A2` — `(function* () {}).bind(null)` → true — no `!hasOwnPrototype` self-check,
  so bound (no own prototype) and unbound (own writable prototype) both admit. `[Q.002]`
- `iARGF/R1` — `async function* () {}` → false (tag mismatch).
- `iARGF/R2` — `function () {}` → false (`hasConstructSlot` true → `!hasConstructSlot`
  fails).
- `iARGF/R3` — `async function () {}`, `() => {}` → false (tag mismatch / proto-surface
  lacks `prototype`).
- `iARGF/R4` — `null`, `{}` → false.

### `isAlienRealmAsyncGeneratorFunction(value?)` — `@internal`

`!hasConstructSlot(value) && hasAsyncGeneratorFunctionIdentitySignal(value) && hasAnyGeneratorFunctionPrototypeSurface(value)`.
Was `hasAsyncGeneratorFunctionShape` (renamed #080); now narrows
`value is T & AsyncGeneratorFunction`.

- `iARAGF/A1` — `async function* () {}`, `({ async *m() {} }).m` → true.
- `iARAGF/A2` — `(async function* () {}).bind(null)` → true (same self-check omission).
  `[Q.002]`
- `iARAGF/R1` — `function* () {}` → false (tag mismatch).
- `iARAGF/R2` — `function () {}`, `async function () {}`, `() => {}` → false.
- `iARAGF/R3` — `null`, `{}` → false.

### `isCurrentRealmAsyncFunctionInstance(value?)` — `@internal` (same-realm `instanceof` arm)

`try { value instanceof %AsyncFunction% } catch { false }` — throw-safe (`@@throw-safe`).
New (#080); narrows `value is T & AsyncFunction`.

- `iCRAFI/A1` — `async function () {}`, `async () => {}`, `(async () => {}).bind(null)` →
  true (the `[[Prototype]]` chain traces to the local `%AsyncFunction.prototype%`; `bind`
  preserves it). `[Q.002]`
- `iCRAFI/R1` — a cross-realm async function (fixture) → false — its `[[Prototype]]`
  traces to the _foreign_ realm's `%AsyncFunction.prototype%`; this is exactly why the
  alien-realm arm exists.
- `iCRAFI/R2` — `function () {}`, `function* () {}`, `class C {}` → false.
- `iCRAFI/B1` — `new Proxy(async () => {}, { get() { throw new Error(); } })` → **true,
  not thrown**. `instanceof` walks `[[GetPrototypeOf]]` and never fires the `get` trap,
  and the target's chain still traces to `%AsyncFunction%`. A surprising standalone-arm
  result the decidability run must confirm — in production the `isFunction` gate
  (`isFunction/B1`) rejects this hostile `Proxy` upstream, so the orchestrator returns
  `false`. (Pin this.)
- `iCRAFI/B2` — a `Proxy` whose `getPrototypeOf` trap throws → false, _not thrown_ (the
  `instanceof` is wrapped).

### `isCurrentRealmGeneratorFunctionInstance(value?)` — `@internal` (same-realm `instanceof` arm)

`try { value instanceof %GeneratorFunction% } catch { false }` — throw-safe. New (#080);
narrows `value is T & GeneratorFunction`.

- `iCRGFI/A1` — `function* () {}`, `(function* () {}).bind(null)` → true. `[Q.002]`
- `iCRGFI/R1` — a cross-realm sync generator function (fixture) → false (foreign
  `%GeneratorFunction.prototype%`).
- `iCRGFI/R2` — `async function* () {}`, `async function () {}`, `class C {}` → false.
- `iCRGFI/B1` — `new Proxy(function* () {}, { get() { throw new Error(); } })` → **true,
  not thrown** (as `iCRAFI/B1`; gated upstream in production). (Pin this.)
- `iCRGFI/B2` — a `Proxy` whose `getPrototypeOf` trap throws → false, not thrown.

### `isCurrentRealmAsyncGeneratorFunctionInstance(value?)` — `@internal` (same-realm `instanceof` arm)

`try { value instanceof %AsyncGeneratorFunction% } catch { false }` — throw-safe. New
(#080); narrows `value is T & AsyncGeneratorFunction`.

- `iCRAGFI/A1` — `async function* () {}`, `(async function* () {}).bind(null)` → true.
  `[Q.002]`
- `iCRAGFI/R1` — a cross-realm async generator function (fixture) → false.
- `iCRAGFI/R2` — `function* () {}`, `async function () {}` → false.
- `iCRAGFI/B1` — `new Proxy(async function* () {}, { get() { throw new Error(); } })` →
  **true, not thrown** (as `iCRAFI/B1`). (Pin this.)
- `iCRAGFI/B2` — a `Proxy` whose `getPrototypeOf` trap throws → false, not thrown.

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
   `#object` cross-realm test round: `isClass` did its own raw
   `getOwnPropertyDescriptor(value, 'prototype')`, so a hostile constructor (a `Proxy`
   whose `getOwnPropertyDescriptor` trap throws) made `isClass` — and therefore every
   consumer, notably the `#object` plain-object contract — **throw** rather than answer a
   boolean. The design owner green-lit the cross-module root-fix: route the read through
   the throw-safe `getNextAvailableSafeDescriptor` (#056), so a hostile trap yields
   `undefined` (→ `false`). Behavior unchanged for all legit inputs (own `prototype` is
   found at level 0 of the walk); `isClass/B1` added above. **Finding deferred to the
   `function` round:** the sibling `#utility` helpers `hasOwnPrototype` /
   `hasOwnWritablePrototype` (feeding `isES3Function` etc.) carry the same
   raw-`getOwnPropertyDescriptor` surface and want the same treatment. Decision-aligned
   with #056/#029 (no new ADR). **CLOSED 2026-07-28 (ADR #073):** the `hasOwn*` trio moved
   to `try`/`catch`, and `hasOwnNonWritablePrototype` was added as the named class/ES3
   discriminator; `isClass` now delegates to it (formula + `isClass/B1` updated above).

4. **Realm decomposition of the species arms — RECONCILED 2026-07-28 (ADR #080).** The
   three `has*Shape` structural arms were renamed to `isAlienRealm*` and gained
   generic-guard returns (`value is T & X`); the same-realm `instanceof` fast path,
   previously inlined in each orchestrator, was extracted into three new `@internal` arms
   (`isCurrentRealm*Instance`), also generic guards, also `try`/`catch`-wrapped. The
   orchestrator formulas, the surface inventory (9 → 12 helpers, 21 → 24 value exports),
   the helper specs (renamed + three new sections with vectors), and
   `architecture/function.md` were amended to match. No public predicate behavior changed.
   New standalone-arm result pinned: `isCurrentRealm*Instance` returns **true** on a
   hostile `get`-trap `Proxy` over a genuine local function (`iCRAFI/B1` etc.) —
   `instanceof` never fires the trap.

5. **Throw-safety reconciliation — RECONCILED 2026-07-28 (ADRs #073, #076).** The freeze
   predates the throw-safety model. Corrections: `getFunctionSource` returns
   `string | undefined` and its `gFS/B1` flipped _throws_ → `undefined`; `isFunction` is
   now `try`/`catch`-wrapped (throw-safe against a hostile `get`-trap `Proxy`,
   `isFunction/B1` added); the module carries 24 `@@throw-safe` markers. The
   `hostile × predicate` completeness matrix that verifies the markers is owed to the
   function test round — see Open items #1.

6. **Bound-admission asymmetry — SETTLED 2026-07-28 (ADR #081, closes Q.002).** The
   `[Q.002]` policy question is closed in favor of the shipped asymmetry: bound detection
   is inexpensive (`name.startsWith('bound ')`, #009) but spoofable, hence unreliable, so
   a reliability-first type-detection library declines it; forcing symmetry would require
   importing that unreliable signal, which belongs to introspection (`isBoundFunction`,
   Q.003). The `[Q.002]` tags are retained as findable cross-refs to the settled decision.

## Throw-safety (axis 5) — completeness oracle

The module marks **24** exports `@@throw-safe` (ADRs #073, #076): each must not propagate
on hostile input (a `Proxy` trap that throws), yielding a sentinel (`false` / `undefined`)
instead. The marked set is the completeness oracle — the `hostile × predicate` matrix the
test round builds must score exactly this set:

`getFunctionSource`, `isCallable`, `isFunction`, `hasConstructSlot`, `isNewableFunction`,
`isES3Function`, `isClass`, `isCustomClass`, `isBuiltInClass`,
`hasAsyncFunctionIdentitySignal`, `hasAsyncFunctionPrototypeSurface`,
`isAlienRealmAsyncFunction`, `isCurrentRealmAsyncFunctionInstance`, `isAsyncFunction`,
`hasGeneratorFunctionIdentitySignal`, `hasAsyncGeneratorFunctionIdentitySignal`,
`hasAnyGeneratorFunctionPrototypeSurface`, `isAlienRealmGeneratorFunction`,
`isAlienRealmAsyncGeneratorFunction`, `isCurrentRealmGeneratorFunctionInstance`,
`isCurrentRealmAsyncGeneratorFunctionInstance`, `isGeneratorFunction`,
`isAsyncGeneratorFunction`, `isAnyGeneratorFunction`.

## Open items

1. **Throw-safety `hostile × predicate` matrix (axis 5) — RESOLVED 2026-07-28 (function
   test round).** The 24 `@@throw-safe` exports above claim non-propagation; the matrix
   verifying each against the hostile-trap vectors is now authored in
   `test/function/throw-safety.test.js` — every marked export × six hostile-trap rows
   asserts a returned sentinel (never a throw), and a completeness guard cross-checks the
   scored set BOTH against the `@@throw-safe` markers parsed from `src/function.js`
   (source drift) AND the imported function set (test drift). The marked set is the
   completeness oracle; source, oracle, and tests are triple-locked.

2. **Structural invariants promoted to a STANDING suite — RESOLVED 2026-08-04.** The
   function round's hostile-probe (52 values × 12 predicates, 0 breaches, 2026-07-28) was
   ephemeral: it proved the implementation clean once, then was discarded. Its two halves
   are now split by concern. The throw-safety fuzzing stays ephemeral — axis 5 (item 1
   above) owns that oracle permanently. Its structural-invariant half is committed as
   `test/function/invariants.test.js` (732 tests), asserting the spec-free RELATIONSHIP
   laws the absolute-value matrices do not: the callability floor (every public predicate
   ⇒ `isCallable`; every refinement below it ⇒ `isFunction`) · the `isClass` partition
   (`isClass ≡ isCustomClass ⊎ isBuiltInClass` — the law named under `isBuiltInClass`
   above, now machine-checked) · the newable ladder
   (`isNewableFunction ≡ isFunction ∧ hasConstructSlot`, with `isES3Function ⊎ isClass`
   disjoint by own-`prototype` writability) · the generator umbrella
   (`isAnyGeneratorFunction ≡ the two arms`, disjoint) · coroutine-family exclusivity (an
   async generator is NOT an async function) · the coroutine families are never newable ·
   cross-realm verdict symmetry over the full 12-predicate surface · determinism ·
   non-collapse witnesses. Asserted over the whole candidate corpus including bound forms,
   foreign-realm callables, tag-spoofs and the throwing traps. Mutation-verified (4 solo
   mutations → 82 / 7 / 34 / 10 red, each attributable).

   _Provenance —_ owed, not new. The promotion decision was taken mid-back-sweep
   (2026-07-29), after `function` had already been finalized (2026-07-28), so `function`
   was scoped out of the very sweep that introduced the standard and its compliance row
   recorded only "the ephemeral probe was run". An instance of **standard-coverage drift**
   — a standard promoted mid-flight reaches only the artifacts in front of it. `primitive`
   carried the same debt (see `PRIMITIVE.spec.md` resolved item #8, paid the same day);
   `config` is a genuine exemption (predicate-free, no lattice).

## Policy flags

- **Q.002 — bound-admission asymmetry — SETTLED (ADR #081).** All `[Q.002]`-tagged vectors
  encode the SHIPPED behavior: the strict newable predicates (`isES3Function`, `isClass`)
  reject bound variants; the species predicates (`isAsyncFunction`, `isGeneratorFunction`,
  `isAsyncGeneratorFunction`, `isAnyGeneratorFunction`) and `isNewableFunction` /
  `hasConstructSlot` admit them. Closed in favor of the asymmetry: the inexpensive bound
  tell (`name.startsWith('bound ')`, #009) is spoofable, hence unreliable — a
  reliability-first type-detection library declines it, so no predicate reads it and the
  asymmetry is the free residue of each predicate's spec-invariant discriminator. The tags
  now cross-ref a settled decision rather than a pending flip. See Resolved items #6 and
  ADR #081.
- **Q.003 — introspection-tier discriminations.** Two distinctions the structural schema
  deliberately cannot resolve and that no predicate here claims: arrow vs. concise method
  (descriptor-identical; `[[HomeObject]]` is the only tell), and bound vs. unbound within
  the arrow/concise and species rows. Both belong to `@species-js/function-introspection`.
  Recorded as boundaries, not gaps.
