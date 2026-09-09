# type-identity — behavioral specification

> Spec format and the multi-axis test model come from
> [type-detection's spec README](../../../type-detection/docs/spec/README.md). This
> package follows that model and does not restate it.
>
> Written from `src/index.d.ts`, `src/index.js`, `src/config/index.{js,d.ts}`, the
> hardening round `0395fd8`, and ADRs #079 (presence is a property of the call), #086
> (where captures live), #094 (`canOwnPropertyBeShaped`'s contract) and #099 (the
> published entry is the surface gate).
>
> **Status: FROZEN 2026-09-09** — owner-reviewed. This is the base for the axis-1
> (contract) suite, which does not exist yet: the package carries the surface guard in
> `test/index.test.js` and nothing else, so no vector below is asserted anywhere but here.
> From here on, amend this file in place with a dated banner (#054) rather than rewriting
> it — a spec that contradicts the code is worse than an amended one.

### How to read this

A **vector** is one testable claim with a stable ID, written as
`input → expected — rationale`. The ID is what a test cites, so spec and suite stay
traceable. IDs are **append-only**: never renumber one, add a higher number or mark it
withdrawn.

The class letter says what kind of claim it is. `A` — accepted. `R` — refused. `B` — a
boundary worth pinning, usually where the specified behavior is the surprising one. `T` —
a type-level claim, checked by `pnpm run typecheck` rather than at runtime.

This spec holds **112 vectors** — `ident` 9, `define` 32, `ord` 7, `brand` 14, `carry` 19,
`shape` 7, `cause` 7, `realm` 4, `cap` 3, `type` 10. The number is derived by grepping the
IDs out of this file rather than counted by hand, and it is the suite's target.

Every vector here was checked by **running it** when it was written, not by reading the
code. Ten probe rounds ran against the real entries through `#index`, with
`@species-js/type-detection` resolved to source by the vitest alias (#089), plus a
typecheck fixture under `tsc` for the `type/T*` band. The probes were then deleted, per
the decidability-run convention.

Three documented claims did not survive that check, each being wider than the behavior it
described. All three are scoped in the source prose this spec is written against — the ES3
`prototype` pointer, the built-in admission, and the error-cause stand-in's equivalence
with the native form — and all three are specified as boundaries below.

## Module contract

`@species-js/type-identity` makes a userland type **recognizable after it stops being
identical**. Across a realm boundary — an iframe, a worker, a second copy of the same
module — `instanceof` fails, because the constructor a value was built from is not the
constructor the checking code holds. What survives is structure. The package installs that
structure and reads it back.

It exports three functions and three types:

- **`defineStableTypeIdentity`** freezes three slots at once — the constructor's own
  `name`, its prototype's `constructor` back-reference, and a `Symbol.toStringTag` getter
  on that prototype.
- **`brandFunctionName`** freezes `name` alone, for a callable whose observable name must
  survive a minifier.
- **`doesCarryStableTypeIdentity`** reports whether a value carries the frozen shape.

Three `@internal` values are exported alongside them so verification can reach them
directly: `isSupportedConstructor`, `getIdentifierAsSafeResult` and
`resolveErrorWithCause`.

### Why this spec is shaped differently

The shared README's template is organized per public predicate: **Admits** / **Rejects**
lists, a **Refuses to claim** section, cross-realm and spoof-resistance expectations. Two
of this package's three entries are not predicates but **mutators**, and their contract is
not an accept/reject matrix. It is an **ordered rejection list** — twelve conditions for
`defineStableTypeIdentity`, five for `brandFunctionName` — where the first blocking
condition ends the attempt. The oracle is therefore _which reason, in which order_, and a
vector that pinned only "this input fails" would assert a fraction of the contract.

`CONFIG.spec.md` and `CUSTOM-NAMESPACE.spec.md` are the in-repo precedent for a spec that
declares its own dimensions rather than forcing a non-predicate module into the predicate
template. This one has six:

| Dimension                   | Question it answers                                    | Prefix                        |
| --------------------------- | ------------------------------------------------------ | ----------------------------- |
| **A — Identifier contract** | Which `name` and tag values are accepted, and as what? | `ident/*`                     |
| **B — Freezing**            | What lands on a constructor, and what refuses it?      | `define/*`, `ord/*`           |
| **C — Branding**            | What lands on a callable, and what refuses it?         | `brand/*`, `ord/A7`           |
| **D — Verification**        | Which values are reported as carrying the identity?    | `carry/*`                     |
| **E — Helper contracts**    | What do the three exported `@internal` values promise? | `shape/*`, `cause/*`          |
| **F — Environment**         | What holds across realms, and what is captured where?  | `realm/*`, `cap/*`, `type/T*` |

Dimension D is the only one the shared predicate template fits unchanged.

### The throw contract — two rules, not one

type-detection's universal invariant is that a predicate answers `false` on any throw.
This package keeps that rule for its one predicate and adds a second, stronger one for its
two mutators:

- **`doesCarryStableTypeIdentity` returns `false` on every input**, hostile ones included.
  It has no second channel to report through, so an unreadable value is answered exactly
  as a value that simply lacks the shape.
- **Neither freezing entry ever throws.** Every refusal — an invalid argument, an
  un-shapeable slot, a `Proxy` trap that throws or lies — arrives as
  `{ success: false, reason }`, and `reason` is always an `Error`, a non-error throw being
  wrapped and carried as the wrapper's `cause`.

The second rule is what makes the numbered condition lists a contract rather than a
description: a caller reads the reason, never catches it. Every hostile input this spec
constructs — a revoked `Proxy`, a `getOwnPropertyDescriptor` trap that throws, a
`defineProperty` trap that throws, a `defineProperty` trap that lies by returning falsish,
a boxed `String` whose every coercion path throws — was measured to return rather than
throw.

Both rules cover the same hostile-input classes: descriptor-trap, define-trap, coercion
throw, revoked proxy. What differs is the reporting channel, not the exposure.

### Deliberate acts are described, not prevented

Several vectors below record an outcome a caller can only reach by acting deliberately on
a value they hold: replacing a constructor's prototype after it was frozen, grafting a
`prototype` onto a bound function, handing a built-in to the branding entry. Where the
package did exactly what it said and touched nothing beyond its stated slots, the
consequence belongs to whoever chose it, and this spec's job is to describe the outcome
rather than to design a gate against it.

The same reading settles the one case where the package asserts an equivalence rather than
judging a value. The error-cause stand-in is a private seam, and its fidelity is owed over
the inputs the package actually gives it — an object literal — not over the exotic option
bags a direct caller of an `@internal` export could invent. `cause/B1` records where those
two part company.

### Rejection order

The order is contract. Arguments are validated before slots are probed, so a bad argument
is reported even against a target that could not have been frozen anyway, and one mistake
always reports the same way.

For the two freezing entries, this spec's `R` numbering **is** the `.d.ts`'s condition
numbering: `define/R7` pins condition 7. The alignment is a convenience and not a promise
— the contract already went from eleven conditions to twelve once (`0395fd8`) — so if a
condition is ever inserted, new vectors append at the end and the mapping column below
becomes the only truth.

## Surface inventory

Mechanical completeness before any vectors, per the audit discipline.

| Export                        | Module    | Visibility  | Kind      | Notes                                          |
| ----------------------------- | --------- | ----------- | --------- | ---------------------------------------------- |
| `defineStableTypeIdentity`    | `#index`  | public      | function  | the three-slot freeze                          |
| `brandFunctionName`           | `#index`  | public      | function  | the `name`-only freeze                         |
| `doesCarryStableTypeIdentity` | `#index`  | public      | predicate | the inert read-back                            |
| `IdentityDefinitionResult`    | `#index`  | public      | type      | the union both mutators return                 |
| `IdentityDefinitionSuccess`   | `#index`  | public      | type      | `{ success: true, warning?: string }`          |
| `IdentityDefinitionFailure`   | `#index`  | public      | type      | `{ success: false, reason: AnyError }`         |
| `isSupportedConstructor`      | `#index`  | `@internal` | predicate | the shape gate, exported for assertability     |
| `getIdentifierAsSafeResult`   | `#index`  | `@internal` | verifier  | the identifier gate, exported likewise         |
| `resolveErrorWithCause`       | `#index`  | `@internal` | function  | the capability seam, exported for both arms    |
| `ErrorWithCauseConstructor`   | `#index`  | `@internal` | type      | the two-argument `Error` shape                 |
| `globalContext`               | `#config` | `@internal` | capture   | realm-fixed, ADR #086                          |
| `getPrototypeOf`              | `#config` | `@internal` | capture   | realm-fixed, retyped                           |
| `defineProperty`              | `#config` | `@internal` | capture   | realm-fixed — the only write the package makes |
| `getOwnPropertyDescriptor`    | `#config` | `@internal` | capture   | realm-fixed, raw (not throw-safe)              |

Five values are module-local and deliberately not exported: `toReportableError`,
`getOwnPropertyDescriptorAsSafeResult`, `canOwnNameBeShaped`, `isES3Function` and
`isCustomClass`, plus the module-scoped `Error` binding the seam resolves at load.

Every branch those five carry must be reachable through the public entries or through the
three exported `@internal` values, or it is unreachable and should not exist. The helper
axis (axis 4) therefore covers three helpers here, not eight.

`#config` is not a published subpath; the bundler inlines it into the entry. The package's
`exports` map has a single `"."` entry.

## A — Identifier contract (`ident/*`)

One helper, `getIdentifierAsSafeResult`, decides all three identifier parameters —
`constructorName`, `taggedType` and `fctName`. Its rejections are the same two everywhere,
differing only in the quoted parameter name, so they are specified once here and
referenced by condition number below.

- `ident/A1` — `'Foo'` → `{ error: null, value: 'Foo' }`.
- `ident/A2` — `'  Foo  '` → `'Foo'`. Trimmed at the edges only: `'  a b  '` → `'a b'`,
  and `' a\nb '` → `'a\nb'`.
- `ident/A3` — `new String(' Foo ')` → `'Foo'`, and `typeof` the result is `'string'`. The
  unwrap is not cosmetic: a wrapper written into a `name` slot breaks every consumer
  reading it as the string the language specifies, and `Object.prototype.toString` ignores
  a `Symbol.toStringTag` that is not a primitive string — measured, an object-valued tag
  yields `[object Object]`.
- `ident/R1` — `42`, `null`, `undefined`, `Symbol('x')`, `{}` → `TypeError`,
  `The provided "<parameterName>" parameter needs to be a string.`
- `ident/R2` — `''` and `'   '` → `RangeError`,
  `Invalid string value passed as "<parameterName>".`
- `ident/R3` — `new String('')` and `new String('   ')` → `RangeError`. The unwrap runs
  before the emptiness test, which is the whole point of doing it: `new String('') === ''`
  is `false`, so an empty wrapper would otherwise walk straight past the check.
- `ident/R4` — an instance of a `String` subclass (`class Sub extends String {}`) →
  `TypeError`. The accepted set is exactly a primitive string or a direct boxed `String`.
- `ident/B1` — a `Proxy` over a boxed `String` whose `toString`, `valueOf` and
  `Symbol.toPrimitive` all throw → `TypeError`, **not** a throw. The type check refuses it
  before any coercion is attempted, which is what keeps the freezing entries' "never
  throws" true against a hostile identifier.
- `ident/B2` — a degenerate **value** is refused (`''`), a bad **type** is refused (`42`),
  and the two are told apart by their error class. `RangeError` means "you meant a name
  and gave an empty one"; `TypeError` means "that was not a name at all".

## B — Freezing (`define/*`)

### What lands

- `define/A1` — `defineStableTypeIdentity(class C {}, 'Foo')` → `{ success: true }`;
  `C.name` is `'Foo'`, `Object.prototype.toString.call(new C())` is `'[object Foo]'`, and
  both `C` and `new C()` answer `doesCarryStableTypeIdentity` with `true`.
- `define/A2` — the same for an ES3 constructor function.
- `define/A3` — a supplied tag that differs from the name succeeds **and says so**:
  `defineStableTypeIdentity(class C {}, 'Bar', 'Baz')` →
  `{ success: true, warning: '2 different identifiers have been assigned, "Bar" as constructor name and "Baz" as tagged type.' }`,
  and instances answer `'[object Baz]'`.
- `define/A4` — an omitted tag defaults to the name; the result's own keys are exactly
  `['success']`. With a warning they are exactly `['success', 'warning']`; on failure,
  exactly `['success', 'reason']`.
- `define/A5` — the warning compares the **normalized** identifiers:
  `(C, 'Foo', '  Foo  ')` and `(C, 'Foo', new String('Foo'))` both succeed without one.
  Comparing before the unwrap would compare wrapper identities rather than text.
- `define/A6` — the three installed descriptors are exactly: the prototype's
  `Symbol.toStringTag`
  `{ get: fn, set: undefined, enumerable: false, configurable: false }`; the prototype's
  `constructor`
  `{ value: <the constructor>, writable: false, enumerable: false, configurable: false }`;
  the constructor's `name`
  `{ value: <the identifier>, writable: false, enumerable: false, configurable: false }`.
- `define/A7` — the getter closes over the tag, so it cannot be made to answer differently
  once installed.
- `define/A8` — an ES3 function whose `prototype` was reassigned to a plain object freezes
  **that** object: `proto.constructor === F` afterward.
- `define/A9` — two different constructors may take the same name and tag. The package
  registers nothing and enforces no uniqueness.
- `define/A10` — a callable `prototype` is accepted: `F.prototype = function inner() {}`
  freezes and carries. The gate is `isObjectOrCallable`, not "plain object".
- `define/A11` — an inherited, non-configurable `Symbol.toStringTag` on a base prototype
  does not block a derived class: the derived prototype's own slot is still free, and
  instances answer the derived tag.
- `define/A12` — a constructor created in another realm freezes exactly as a local one
  does (`realm/A1`).

### Boundaries

- `define/B1` — **freezing slots is not freezing objects.** Afterward the constructor and
  its prototype are both still extensible: new prototype members and new statics can be
  added. The freeze covers three slots, nothing else.
- `define/B2` — **the three frozen slots are the guarantee; the constructor's `prototype`
  pointer is not.** An ES3 function's own `prototype` slot stays
  `{ writable: true, configurable: false }` after freezing — writability is what
  identifies the ES3 shape — so `F.prototype = {}` succeeds, and from then on
  `doesCarryStableTypeIdentity(F)` answers `false` and new instances answer
  `'[object Object]'`. A class holds that pointer
  `{ writable: false, configurable: false }` natively, so the same assignment is refused
  and its pair stays closed. **Nothing is unfrozen either way:** the frozen prototype
  still carries the frozen `constructor` and the tag getter, and every value already built
  from it keeps both its tag and its verdict. Reassigning a constructor's prototype
  wholesale replaces the type; it does not defeat the freeze.
- `define/B3` — a `Proxy` over an ES3 function is admitted; a `Proxy` over a class is not.
  `Function.prototype.toString` on any proxy reports `function () { [native code] }`, so
  the class arm's source read fails while the ES3 arm's descriptor read passes through.
- `define/B4` — a bound newable given an own writable `prototype` passes the shape gate
  and **freezes successfully** — but `new` on a bound function consults the target's
  prototype, not the bound function's, so its instances answer `'[object Object]'`. The
  freeze lands where it was asked to land; construction simply reads elsewhere. Grafting a
  `prototype` onto a bound function is a deliberate act, and the entry freezes the shape
  it is given rather than auditing how that shape came about.
- `define/B5` — two constructors sharing one prototype object: the first freezes, the
  second is refused at condition 10, the shared `constructor` slot now being frozen.
- `define/B6` — a subclass of a frozen class **inherits the tag but not the verdict**.
  `Object.prototype.toString.call(new D())` answers the parent's tag, because the lookup
  walks the chain; `doesCarryStableTypeIdentity(D)` and
  `doesCarryStableTypeIdentity(new D())` answer `false`, because the check reads own
  descriptors. Freezing `D` in its own right makes both answer for `D`.
- `define/B7` — **the entry is not transactional.** The defines run tag, constructor,
  name, and a failure between them leaves what already landed. Measured on a prototype
  whose `defineProperty` trap throws on its second call: the tag is installed
  non-configurably, the `constructor` slot is absent, the constructor's `name` still
  carries its native `{ writable: false, configurable: true }` descriptor, and the verdict
  is `false`. The retry then fails at condition 11 on the now-unshapeable tag — the state
  is loud rather than silent. Writing `name` last is what keeps an ordinary failure from
  touching the constructor object at all.
- `define/B8` — condition 9's "no own `prototype` descriptor at all" sub-case is real but
  narrowly reachable. Any ordinary function's own `prototype` slot is non-configurable, so
  a `Proxy` that reports it to the shape probe and then withdraws it trips a proxy
  invariant, and the resulting engine `TypeError` surfaces at condition **8**. Reaching 9
  by withdrawal takes a target whose `prototype` slot is configurable — a bound newable
  given one by hand. The everyday route to 9 is a non-object `prototype` **value**.

### Why the `prototype` pointer is left alone

`define/B2` is the one boundary where a caller can undo a successful freeze, so it is
worth saying why the entry does not close it. Three reasons, and they compound.

The writability of an ES3 function's `prototype` slot **is** the shape. It is the flag the
shape gate reads to tell the ES3 arm from the class arm, so freezing it would erase the
property that identified the constructor in the first place, and the two arms would stop
being distinguishable after freezing.

Nothing is unfrozen by the swap. The frozen prototype keeps its frozen `constructor` and
its tag getter, and every value already built from it keeps both its tag and its verdict.
What a reassignment produces is a constructor pointing at a different, unfrozen prototype
— a replaced type, not a broken freeze.

And a fourth slot would contradict `define/B1`. This package promises three slots and
promises that it freezes slots rather than objects; reaching past them to protect a caller
from their own assignment would buy tamper-resistance with the smaller, clearer guarantee.

### Rejection order (`define/R1`–`define/R12`)

Each vector below pins one condition of the `.d.ts`'s ordered list. The reason's class and
message are part of the claim.

| Vector       | Condition | Class              | Message                                                                                                                                                                            |
| ------------ | --------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `define/R1`  | 1         | `TypeError`        | `The provided "constructor" parameter has to be at least a constructable function-type.`                                                                                           |
| `define/R2`  | 2         | `TypeError`        | `The provided "constructor" parameter needs to be either an ES3 constructor function or a class-syntax constructor. Built-in constructors and bound newables carry neither shape.` |
| `define/R3`  | 3         | `TypeError`        | `ident/R1`, quoting `constructorName`                                                                                                                                              |
| `define/R4`  | 4         | `RangeError`       | `ident/R2`, quoting `constructorName`                                                                                                                                              |
| `define/R5`  | 5         | `TypeError`        | `ident/R1`, quoting `taggedType`                                                                                                                                                   |
| `define/R6`  | 6         | `RangeError`       | `ident/R2`, quoting `taggedType`                                                                                                                                                   |
| `define/R7`  | 7         | `TypeError`        | `The passed constructor's "name" property cannot be redefined.`                                                                                                                    |
| `define/R8`  | 8         | _the caught error_ | unchanged, or a wrapper: `Reading the own "prototype" property-descriptor threw.`                                                                                                  |
| `define/R9`  | 9         | `TypeError`        | `The passed constructor's "prototype" property is invalid.`                                                                                                                        |
| `define/R10` | 10        | `TypeError`        | `The passed constructor's prototypal "constructor" property cannot be redefined.`                                                                                                  |
| `define/R11` | 11        | `TypeError`        | `The passed constructor's prototypal "Symbol.toStringTag" property cannot be redefined.`                                                                                           |
| `define/R12` | 12        | _the caught error_ | unchanged, or a wrapper: `Defining one of the identity properties threw.`                                                                                                          |

The inputs each condition is pinned by:

- `define/R1` — an arrow function, an `async` function, a generator function, a concise
  method, `{}`, `null`, `'nope'`, and a **revoked** `Proxy` over a function. Everything
  without a `[[Construct]]` slot, plus everything whose construct probe cannot run.
- `define/R2` — `Array`, `Date`, `Symbol`, `Function`; a bound class and a bound ES3
  function; a `Proxy` over a class; a `Proxy` whose `getOwnPropertyDescriptor` trap always
  throws; `Object.freeze(function F() {})`; and a function whose own `prototype` was made
  non-writable. **The gate is shape, not origin** — a built-in fails it on the source
  read, a bound newable earlier still, on the descriptor. The message names the two common
  causes rather than the mechanism, which is why the frozen and doctored functions above
  land here too.
- `define/R3` / `define/R4` — `ident/R1` and `ident/R2` applied to `constructorName`.
- `define/R5` — a supplied non-string tag: `42`, `null`, and — the case the arity rule
  exists for — an **explicitly passed `undefined`**. Presence is decided by `args.length`,
  so an explicit `undefined` is a supplied argument and is refused; only a genuinely
  omitted third argument takes the default. Before `0395fd8` all three read as omitted and
  were silently defaulted.
- `define/R6` — `'   '` and `new String('')` as the tag.
- `define/R7` — a re-freeze of an already-frozen constructor (its `name` was frozen by the
  first call), `Object.freeze(class C {})`, and a callable already branded by
  `brandFunctionName`.
- `define/R8` — a `Proxy` whose `prototype` descriptor read throws **after** the shape
  probe has passed. A `RangeError` thrown by the trap arrives as that same `RangeError`; a
  thrown string arrives as an `Error` with the wrapper message and the string as its
  `cause`.
- `define/R9` — `F.prototype = 42`, `'str'`, `null`, `undefined`; and the withdrawn
  descriptor of `define/B8`.
- `define/R10` — a frozen prototype object, and a prototype whose `constructor` was
  explicitly defined non-configurable.
- `define/R11` — a prototype carrying an own non-configurable `Symbol.toStringTag`.
- `define/R12` — a prototype whose `defineProperty` trap throws (the error passes through
  unchanged), throws a non-error (wrapped, with the value as `cause` under
  `{ writable: true, enumerable: false, configurable: true }` — the flags a native `cause`
  carries), or **lies by returning falsish**, in which case the engine's own
  `TypeError: 'defineProperty' on proxy: trap returned falsish for property 'Symbol(Symbol.toStringTag)'`
  becomes the reason. The lying trap is the case the three shapeability probes cannot
  foresee, and the reason condition 12 exists.

### Ordering (`ord/*`)

The first six pin `defineStableTypeIdentity`; the last pins the same rule in
`brandFunctionName`.

- `ord/A1` — a non-newable with an invalid name reports condition **1**.
- `ord/A2` — a built-in with an invalid name reports condition **2**. The constructor is
  judged before either identifier.
- `ord/A3` — an already-frozen class with an invalid name reports condition **3**, not 7.
  Arguments are settled before slots are probed.
- `ord/A4` — an already-frozen class with an invalid tag reports condition **5**, not 7.
- `ord/A5` — an invalid name and an invalid tag together report condition **3**. The name
  is verified first.
- `ord/A7` — the rule holds for `brandFunctionName` too: an invalid name against an
  already-branded callable reports its condition **2**, not 4.
- `ord/A6` — presence is settled before validity: `args.length` decides whether the tag is
  read at all, before `getIdentifierAsSafeResult` ever sees it.

## C — Branding (`brand/*`)

- `brand/A1` — `brandFunctionName(function original() {}, 'branded')` →
  `{ success: true }`; the own `name` descriptor is then
  `{ value: 'branded', writable: false, enumerable: false, configurable: false }`.
- `brand/A2` — any callable is admitted: an arrow function, a `class` constructor, a bound
  function, an `async` function.
- `brand/A3` — the name is trimmed and unwrapped exactly as `ident/A2` and `ident/A3`
  specify; `typeof fct.name` is `'string'` afterward.
- `brand/A4` — the success arm's own keys are exactly `['success']`. It never carries a
  `warning`; that field belongs to the freezing entry's two-identifier case, which has no
  counterpart here.
- `brand/A5` — a `Proxy` over a function is branded, the trap forwarding the define.
- `brand/A6` — instances read the brand through `constructor.name`.
- `brand/B1` — **a built-in is admitted, and the change is permanent.**
  `brandFunctionName(Math.max, 'maximum')` succeeds; `Math.max.name` is `'maximum'`
  thereafter and can never be changed again. `parseInt` likewise. The freezing entry's
  refusal of built-ins follows from the shape it requires, not from a policy this entry
  omits: nothing here reads a prototype, so there is no shape test for a built-in to fail.
  Nor is any capability escalated — a caller able to reach this entry could already have
  called `Object.defineProperty` on `Math.max` — so the admission is documented rather
  than gated, and an origin check here would invent the very policy #094 rules the
  workspace does not have.
- `brand/B2` — branding installs **no** identity: `doesCarryStableTypeIdentity` stays
  `false` and instances answer `'[object Object]'`. The two entries are not a
  weak-and-strong pair over the same shape; they freeze different things.
- `brand/B3` — a brand is a one-way door that also closes the freezing entry's: a branded
  class is refused by `defineStableTypeIdentity` at condition 7.
- `brand/R1` — condition 1 — `{}`, `null` → `TypeError`,
  `The provided "fct" parameter needs to be a function-type.`
- `brand/R2` — condition 2 — `ident/R1`, quoting `fctName`.
- `brand/R3` — condition 3 — `ident/R2`, quoting `fctName`.
- `brand/R4` — condition 4 — a second call on the same callable,
  `Object.freeze(function () {})`, and a revoked `Proxy` → `TypeError`,
  `The passed callable's "name" property cannot be redefined.` A revoked proxy is still
  callable, so it passes condition 1 and is absorbed to `false` by the throw-safe
  shapeability probe here.
- `brand/R5` — condition 5 — a `defineProperty` trap that throws (passed through
  unchanged), throws a non-error (wrapped as `Branding the "name" property threw.` with
  the value as `cause`), or returns falsish (the engine's
  `TypeError: 'defineProperty' on proxy: trap returned falsish for property 'name'`).

## D — Verification (`carry/*`)

Three criteria must hold **together**, all read from descriptors: the prototype's
`Symbol.toStringTag` is a getter-only, non-configurable, non-enumerable accessor; the
prototype's `constructor` is a non-writable, non-configurable, non-enumerable data
property; and the constructor's own `name` is likewise frozen.

- `carry/A1` — a frozen constructor → `true`.
- `carry/A2` — an instance of a frozen constructor → `true`. Either side of the relation
  is accepted: a newable is inspected directly, anything else through its resolved
  constructor and its `[[Prototype]]`.
- `carry/A3` — an instance of a frozen ES3 constructor function → `true`.
- `carry/A4` — a **hand-forged** shape, three `Object.defineProperty` calls that never
  went through this package → `true`. The check reports that the identity is frozen, never
  that it is authentic.
- `carry/A5` — a frozen foreign-realm constructor and its instances → `true`.
- `carry/R1` — omitted, `null`, `undefined` → `false`.
- `carry/R2` — `42`, `'str'`, `Symbol('s')` → `false`.
- `carry/R3` — `{}`, `Object.create(null)` → `false`.
- `carry/R4` — an unfrozen class, and its instances → `false`.
- `carry/R5` — `Promise`, `Array`, `Math`, `Promise.resolve()` → `false`. Where a built-in
  carries a tag at all it is a non-enumerable **data** property that stays configurable
  (`Promise.prototype`, `Math`); `Array.prototype` carries none, and a built-in
  constructor's own `name` is configurable as well. None of the three criteria hold either
  way.
- `carry/R6` — a callable that was only branded → `false`.
- `carry/R7` — a bound view of a frozen constructor → `false`. `bind` produces a new
  function with its own `name` (`'bound Foo'`) and no own `prototype`.
- `carry/R8` — a `Proxy` whose `getOwnPropertyDescriptor` trap throws, and one whose
  `getPrototypeOf` trap throws → `false`.
- `carry/B1` — all three criteria are load-bearing. Dropping any one answers `false`; so
  does an **enumerable** tag, a tag that is a data property rather than an accessor, and a
  getter-and-setter pair. The tag must be getter-**only**.
- `carry/B2` — the read is **inert**. A prototype whose `Symbol.toStringTag` getter throws
  when invoked answers `true` with the getter called zero times: descriptors are
  inspected, values never coerced.
- `carry/B3` — a frozen constructor's **prototype object**, passed directly, answers
  `false`. It is neither side of the relation: not being newable, it resolves its own
  constructor by walking up from its `[[Prototype]]`, which reaches `Object`.
- `carry/B4` — an instance carrying its **own** `Symbol.toStringTag` answers `true` while
  `Object.prototype.toString.call(instance)` answers the shadowing tag. The verdict is
  about the type's identity, read off the prototype; per-value shadowing is outside it.
- `carry/B5` — an instance of an unfrozen subclass answers `false` while
  `Object.prototype.toString` answers the parent's tag (`define/B6`, from the other side).
- `carry/B6` — after an ES3 prototype swap (`define/B2`) the constructor answers `false`
  while instances made before the swap still answer `true`.

## E — Helper contracts

### The shape gate (`shape/*`)

`isSupportedConstructor` is the union of the two admitted shapes, and its precondition is
that the value is **already known newable** — the `isNewableFunction` half is hoisted to
the call site because it allocates a `Proxy` and runs a `new` on every call.

- `shape/A1` — an ES3 function, a class, a subclass → `true`.
- `shape/A2` — a foreign-realm ES3 function → `true`.
- `shape/R1` — `Array`, `Date`, `Symbol`, `Function` → `false`, on the source read.
- `shape/R2` — a bound class and a bound ES3 function → `false`. `bind` strips the own
  `prototype` slot both shapes are read from, so neither arm has anything to read.
- `shape/R3` — `Object.freeze(function F() {})` and a function whose own `prototype` was
  made non-writable → `false`. Not writable, so not the ES3 shape; not `class`-sourced, so
  not the class shape.
- `shape/B1` — a `Proxy` over an ES3 function → `true`; over a class → `false`
  (`define/B3`).
- `shape/B2` — **the precondition is not re-checked.** An arrow function given an own
  writable `prototype` answers `true`, though it carries no `[[Construct]]` slot at all.
  Outside the precondition the answer is the throw-safe readers' sentinel (`42`, `null`,
  `{}` and a bare arrow all answer `false`), which is a sentinel and not a claim. The
  entry never reaches the predicate in that state, condition 1 having gated it.

### The error-cause seam (`cause/*`)

`resolveErrorWithCause` probes the observable effect of the ES2022 options bag, because
the two-argument form parses on every engine and an engine without it ignores the second
argument silently. The constructor arrives as an argument rather than being read from the
global, which is what keeps both arms reachable under test.

- `cause/A1` — a native `Error` that honors the bag is handed back by **identity**.
- `cause/A2` — a constructor that ignores the second argument selects the stand-in.
- `cause/A3` — a constructor that **throws** when probed also selects the stand-in. A
  throwing probe answers the question in the negative; letting it escape would turn a
  capability question into a load error.
- `cause/A4` — the stand-in installs `cause` as
  `{ value, writable: true, enumerable: false, configurable: true }` — byte-for-byte the
  descriptor the native form installs.
- `cause/A5` — presence, not truthiness: no options bag → no own `cause`; an explicit
  `{ cause: undefined }` → an own `cause` holding `undefined`.
- `cause/A6` — the stand-in's product is an instance of the provided constructor, answers
  `'[object Error]'`, preserves the message, and works when called without `new`.
- `cause/B1` — **the stand-in's trigger is narrower than the native's.** The native form
  installs `cause` whenever `IsObject(options)` holds and `HasProperty` finds it; the
  stand-in requires `isPlainObject(options)` **and** an own key. Six measured divergences,
  native installing where the stand-in does not: a prototype-less bag, an array carrying
  `cause`, a class instance carrying `cause`, an inherited `cause`, a callable carrying
  `cause`, and a boxed `String` carrying `cause`. Two bags agree — an object literal and a
  `Proxy` over one. Unreachable through this package, whose every reason is built from an
  object literal, so the equivalence holds for every error it produces; the gap is visible
  only to a caller of the seam itself.

## F — Environment

### Cross-realm expectation (`realm/*`)

- `realm/A1` — a class created in a `node:vm` context freezes from ours: the result is
  `{ success: true }`, `doesCarryStableTypeIdentity` answers `true` for the constructor
  and for its instances, and `Object.prototype.toString` answers the tag **from inside
  that realm as well as from ours**. The frozen `name` reads back inside the realm too.
- `realm/A2` — a foreign ES3 constructor function is admitted and freezes.
- `realm/R1` — a foreign built-in is refused at condition 2, exactly as a local one is.
  The shape gate reads structure, so it has no realm dependence to lose.
- `realm/B1` — **nothing in the implementation uses `instanceof` or compares constructor
  identity.** Verification is descriptor reads only; freezing is descriptor reads plus
  three defines. That is the mechanism behind the package's reason to exist, and it is
  checkable by grep as well as by vector: the word appears in this package's source only
  inside prose.

The vectors above pass a constructor **across** a realm boundary, which is the mechanism
they can demonstrate directly. The motivating case — the same module evaluated twice, so
that two structurally identical constructors are not identical — follows from `realm/B1`
rather than being pinned by a vector of its own: with no identity comparison anywhere in
the read path, a duplicated type is judged exactly as an original.

### Realm-fixed captures (`cap/*`)

- `cap/A1` — `#config` exports exactly
  `['globalContext', 'getPrototypeOf', 'defineProperty', 'getOwnPropertyDescriptor']`, and
  each is identity-equal to its intrinsic at module-load, so a post-load reassignment of
  the global `Object` cannot redirect what the package reads or writes.
- `cap/A2` — `getOwnPropertyDescriptor` is the **raw** capture. Every use in the entries
  is either already inside a `try` or routed through the module-local throw-safe reader;
  the raw capture is what lets that reader tell an absent descriptor from a trap that
  threw, which the freezing entry needs to separate conditions 8 and 9.
- `cap/A3` — `#config` is not a published subpath. ADR #086 governs placement: a raw
  capture of a platform native stays `@internal` in the package that holds it, while a
  value-add — the `objectHasOwn` retype, the `frozenEntryDescriptor` and
  `sealedEntryAccessor` presets — is imported from the type-detection root.

### Type-level contract (`type/T*`)

Checked by `pnpm run typecheck`, not by a runtime vector. Every one below was verified
against `tsc` before it was written down; the `@ts-expect-error` form fails in both
directions, since an unused directive is itself an error.

- `type/T1` — both accepted arities compile: `(constructor, name)` and
  `(constructor, name, tag)`.
- `type/T2` — an **explicit `undefined`** third argument is a compile error. The rest
  tuple `...taggedType: [] | [string]` states statically the same rule `args.length`
  enforces at runtime, where an optional parameter would have admitted it.
- `type/T3` — a fourth argument is a compile error.
- `type/T4` — `constructorName` is typed `string`, so a boxed `String` is a compile error
  even though the runtime admits and unwraps it (`ident/A3`). The runtime is deliberately
  wider than the type here.
- `type/T5` — `constructor` is typed `unknown`, so nothing is refused there: `{}` and `42`
  both compile. TypeScript cannot express the accepted set — a `class Foo {}` is not
  assignable to `ClassConstructor`, `Callable` or `NewableFunction` — so the precondition
  is carried by the returned `reason` instead.
- `type/T6` — the result is discriminated on `success`: `result.reason` is an error on the
  failing arm, and a compile error both on the bare union and on the success arm.
- `type/T7` — `warning` is `string | undefined` on the success arm.
- `type/T8` — `brandFunctionName` takes `unknown` for `fct` (so `42` compiles) and
  `string` for `fctName` (so `42` does not).
- `type/T9` — `doesCarryStableTypeIdentity` accepts zero or one argument and returns a
  plain `boolean`. It is not a type guard: there is no TypeScript type for "carries a
  frozen identity", and asserting one would be a claim about provenance the runtime check
  explicitly refuses to make (`carry/A4`).
- `type/T10` — `isSupportedConstructor` states its precondition in its parameter type. A
  class literal is **not** assignable to `T & NewableFunction`, so a typed caller must
  narrow with `isNewableFunction` first; the narrowed call compiles and yields `boolean`.
  A suite asserting this helper directly has to go through that narrowing, which is the
  same order the entry uses.

## Refuses to claim

These assert nothing. They are the scope the package declines, and they are prose rather
than vectors for exactly that reason.

- **It does not claim authenticity.** `doesCarryStableTypeIdentity` reports that a shape
  is frozen, never that this package frozen it, and never that the name is deserved. A
  third party may freeze any name onto any constructor (`carry/A4`). It is a
  tamper-resistance guarantee, not a provenance one.
- **It keeps no registry.** Nothing is recorded at freezing time — no `WeakSet`, no map
  from name to constructor — so nothing can be asked "did you make this?" and names need
  not be unique (`define/A9`).
- **It does not deep-freeze.** The freeze covers three slots; the constructor object and
  its prototype stay extensible (`define/B1`).
- **It does not freeze the constructor's `prototype` pointer.** That slot is read and
  never written, so an ES3 function's remains assignable and a class's remains the
  read-only one the language made it (`define/B2`).
- **It does not guard a value's own tag.** An instance may shadow the inherited
  `Symbol.toStringTag` and change what `Object.prototype.toString` answers for that one
  value (`carry/B4`). The identity lives on the type.
- **It does not verify that a frozen prototype is the one construction uses.** `define/B4`
  is the case where those differ, and the entry does not look.
- **It makes no claim about the minifier.** `brandFunctionName` pins the observable
  `name`; it does not prevent a bundler from renaming the identifier the name was derived
  from.
- **It does not detect the package's own artifacts across realms by reference.** There is
  no realm-crossing handshake — the whole design is that structure travels and references
  do not.

## Open items

None. Every design question this spec raises is settled in the source, in an ADR, or as a
boundary vector above. Two that a reader might expect to find here, and where they went
instead:

- **The published surface is curated.** `exports["."]` resolves to `src/public.{js,d.ts}`,
  which names the six published exports one by one, so the four `@internal` exports on
  `#index` are unreachable by a consumer — ADR #099's invariant, enforced statically by
  `surface:check` and at runtime by `test/index.test.js`.
- **The conceptual map exists** —
  [`../architecture/README.md`](../architecture/README.md). It answers _how it works_ and
  states no verdicts; each claim there cites the vector here that pins it.

## Findings from the decidability run

Recorded because a spec that hides how it was checked invites the next reader to trust it
for the wrong reason.

1. **Three documented claims were wider than the behavior.** Each read as true from the
   source and came back false, or merely unqualified, when run: the error-cause stand-in's
   equivalence with the native form, the unqualified "no later code can rewrite", and the
   silent admission of built-ins to the branding entry. Two of the three concern a branch
   no local test would otherwise exercise. All three are scoped in the source prose and
   specified here as boundaries — `define/B2`, `brand/B1` and `cause/B1`.

2. **The condition-9 sub-case needed four attempts to reach** (`define/B8`). The obvious
   reproduction — a `Proxy` that withdraws the `prototype` descriptor — cannot work over
   an ordinary function, because that slot is non-configurable and the withdrawal trips a
   proxy invariant, surfacing at condition 8 instead. This is exactly the shape of a claim
   that reads fine and is nearly untestable, so the spec records the input that does reach
   it rather than leaving the suite to rediscover it.

3. **The partial-failure state was measured, not reasoned about** (`define/B7`). The first
   attempt used a constructor whose inferred `name` already equaled the identifier being
   written, so "the name was not written" and "the name was written" looked identical. The
   descriptor tells them apart; the value does not.

4. **Every "never throws" probe returned.** The two mutators were run against a revoked
   proxy, throwing descriptor traps, throwing define traps, lying define traps and a boxed
   `String` whose every coercion path throws. No input produced a throw, and each produced
   a reason of the documented class.
