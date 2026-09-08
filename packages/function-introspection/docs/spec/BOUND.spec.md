# bound — behavioral specification

> Spec format and the multi-axis model are defined in
> [type-detection's spec README](../../../type-detection/docs/spec/README.md); this
> package follows the same model and does not restate it. Vectors are reasoned from the
> canon (`bound.js`, `bound.d.ts`, `utility/index.{js,d.ts}`, decisions #087 and #088).
> Status: **FROZEN 2026-08-06 · AMENDED 2026-08-07 · AMENDED 2026-08-11 · AMENDED
> 2026-09-07 · AMENDED 2026-09-08** — decidability check passed: every vector below was
> executed against the real predicates through the `#index` barrel before freezing,
> including the cross-realm pairs (`node:vm`) and the two forgery shapes. This spec is the
> base for the axis-1 suite; axes 2–5 derive alongside.
>
> The 2026-08-07 amendment adds `dIBF/B4` and `dSIBF/R14` — the shape mark 3 exists for,
> which no vector had covered — and corrects the disagreement set from four values to
> five. No existing verdict changed. See Resolved item 5.
>
> The 2026-08-11 amendment **moves the axis-4 helper section and the `#utility` half of
> the axis-5 table out to [`UTILITY.spec.md`](./UTILITY.spec.md)**, now that `concise` is
> a second consumer of those helpers. No vector was re-derived, no verdict changed, and
> every identifier is unchanged at the new location. See Resolved item 6.
>
> The 2026-09-07 amendment is the first to **change verdicts**.
> `doesIndicateBoundFunction` stopped reading the function source, so three vectors flip
> and the disagreement set drops from five to three. The reasoning is ADR #100; the
> affected vectors are marked inline and listed in Resolved item 7. This became possible —
> and necessary — once `browser.probes.mjs` could execute the engine question instead of
> citing an observation.
>
> The 2026-09-08 amendment completes that split rather than revising it. The exports it
> introduced are entered in the surface inventory, the two readings and the reconstruction
> helper are given contracts and vectors, and the one admission the JavaScriptCore reading
> adds is named at `dSIBF/B2` and accepted with its reasoning. `dSIBF/R14` is corrected in
> the same pass: it described a rejection on every engine, which stopped being true the
> moment the split landed. No verdict on an engine that renders bound functions
> anonymously changes. See Resolved item 8.

## Module contract

`function-introspection / bound` answers one question at two evidence strengths: **does
this value carry the traces `Function.prototype.bind` leaves behind?**

The defining slot, `[[BoundTargetFunction]]`, is unobservable. There is no proof available
at any strength, which is why #087 places these predicates in this package and #088
forbids naming any of them `is…`. Both exports return a plain `boolean` and grant no
narrowing.

```
entrance-level:  isFunction(value) && !hasOwnPrototype(value)
      │
      ├── any one mark  → doesIndicateBoundFunction          (recall-first)
      └── every mark    → doesStronglyIndicateBoundFunction  (precision-first)
```

The three marks, numbered as every reference below uses them:

1. **`[[Construct]]`** — a construct slot, with the `Proxy` constructor subtracted.
2. **Anonymous native source** — the condensed source equals
   `'function(){[native code]}'`. **Read by the conjunction alone since 2026-09-07** (ADR
   #100); the cascade tries marks 1 and 3, in that order.
3. **`'bound '` name prefix** — the own `name` starts with `'bound '`.

Neither predicate ever invokes the value.

### Throw-safety (the universal invariant)

Both public predicates answer a boolean on **every** input, hostile ones included, and
never propagate.

**The marker's contract, settled here for the package (2026-08-06).** `@@throw-safe` means
_the export does not throw for any input **within its declared parameter type**_. For an
`unknown`-typed parameter that is every value. For a narrowed parameter it is every value
of that type, and the declared type is the enforcement. The package has two such
parameters: `getFunctionSourceCondensate(source: string | undefined)` and
`hasProxyConstructorShape(value: VerifiedFunction)`. Both follow the standing rule that a
helper with a _partial_ body narrows its input rather than accepting `unknown`.

This matters for axis 3: a throw-safety suite must feed hostile values **of the declared
type**. Feeding `42` to a `string`-typed parameter tests nothing about the marker and
reports a defect that is not one.

## Surface inventory

| Export                                                 | Module     | Visibility  | `@@throw-safe` |
| ------------------------------------------------------ | ---------- | ----------- | -------------- |
| `doesIndicateBoundFunction`                            | `#bound`   | public      | yes            |
| `doesStronglyIndicateBoundFunction`                    | `#bound`   | public      | yes            |
| `hasJavaScriptCoreBindBehavior`                        | `#bound`   | public      | no             |
| `doesStronglyIndicateJSCSpecificBoundFunction`         | `#bound`   | `@internal` | yes            |
| `doesStronglyIndicateNonJSCBoundFunction`              | `#bound`   | `@internal` | yes            |
| `createExpectedJSCSpecificFunctionSourceFromBoundName` | `#bound`   | `@internal` | yes            |
| `getCondensedFunctionSource`                           | `#utility` | public      | yes            |
| `getFunctionSourceCondensate`                          | `#utility` | `@internal` | yes            |
| `hasProxyConstructorShape`                             | `#utility` | `@internal` | yes            |
| `doesMatchProxyConstructor`                            | `#utility` | `@internal` | yes            |
| `CONDENSED_NATIVE_SOURCE_FOUNDATION`                   | `#utility` | `@internal` | n/a (constant) |
| `globalContext`                                        | `#config`  | `@internal` | n/a (constant) |
| `getOwnPropertyDescriptors`                            | `#config`  | `@internal` | n/a (capture)  |

The last four rows arrived with the engine split and were entered 2026-09-08. **No gate
reads this table**, so it is the one part of the spec that can fall behind the module
without anything going red — worth a glance whenever `#bound` gains or loses an export.
`hasJavaScriptCoreBindBehavior` carries no `@@throw-safe` marker by design: it takes no
argument, and the marker promises totality within a declared parameter type it does not
have.

Only `doesIndicateBoundFunction`, `doesStronglyIndicateBoundFunction`,
`hasJavaScriptCoreBindBehavior` and `getCondensedFunctionSource` reach a consumer;
`#utility` and `#config` are re-exported nowhere and published as no subpath (#085's
barrel rule).

The `#utility` rows stay listed here because this module composes from them, but their
**contracts and vectors live in [`UTILITY.spec.md`](./UTILITY.spec.md)** as of 2026-08-11;
this table is an inventory, not a specification of them.

## Cross-cutting vectors — the entrance-level

Applies to both predicates identically; neither reads a mark until both hold.

- `bound/X1` — `undefined`, `null`, `42`, `'x'`, `{}`, `[]`, `Symbol()`, `0n`, `true` →
  false — not callable.
- `bound/X2` — an omitted call `f()` → false — `undefined` is outside the accept set, so
  no `arguments.length` gate is needed (#079 honest-by-construction).
- `bound/X3` — a plain function, a class, a generator function, `Array`, `URL` → false —
  each owns a `prototype`, which `bind` never grants.
- `bound/X4` — a revoked callable `Proxy` → false — `isFunction` reads
  `call`/`apply`/`bind` and the revoked traps throw, so the entrance-level fails before
  any mark.
- `bound/X5` — an own `prototype` cannot be shed: it is `configurable: false` on every
  ordinary function, so no ES3 function can masquerade past `X3`.
- `bound/X6` — `Function.prototype.bind(null)` → false, **despite carrying all three
  marks**: no own `prototype`, the condensed anonymous native source, and an own `name` of
  `'bound '`. It fails the entrance-level. `bind` preserves the TARGET's `[[Prototype]]`
  (ECMA-262 §20.2.3.2, `BoundFunctionCreate`), and `Function.prototype`'s own
  `[[Prototype]]` is `Object.prototype` — so the bound result inherits no
  `call`/`apply`/`bind` and `isFunction` rejects it. `Function.prototype` is the root of
  that chain, hence the one standard callable for which binding does NOT produce an
  admitted value. Generalizes: **being bound does not imply being a `VerifiedFunction`.**

## `doesIndicateBoundFunction`

`doesIndicateBoundFunction(value?: unknown): boolean` — entrance-level, then mark 1 OR
mark 3. Ordered by **decisiveness**, because either mark ends the question.

**Mark 2 is not read here (AMENDED 2026-09-07, ADR #100).** It tests whether the value
stringifies as an anonymous native function, which is true of bound functions but equally
true of every callable `Proxy` and of `Function.prototype` — a strictly larger set than
"bound". It is also the only input this predicate had that engines spell differently. The
two marks that remain are both mandated by the language, so this predicate now answers the
same on every conforming engine.

**Admits**

- `dIBF/A1` — `plain.bind(null)` → true — all three marks.
- `dIBF/A2` — `plain.bind(null, 1)` → true — partial application changes `length`, not the
  marks.
- `dIBF/A3` — `K.bind(null)` (bound class) → true — construct slot preserved.
- `dIBF/A4` — `(() => {}).bind(null)` → true — no construct slot; carried by mark 3 alone.
  **AMENDED 2026-09-07:** mark 2 carried it too until #100. The verdict is unchanged;
  `dIBF/R10` is where that loss becomes visible.
- `dIBF/A5` — `obj.concise.bind(null)` → true — same shape as A4.
- `dIBF/A6` — `(function* () {}).bind(null)` → true — generator functions have no
  construct slot, so again mark 3 alone (**AMENDED 2026-09-07**, as `dIBF/A4`).
- `dIBF/A7` — `Math.max.bind(null)` → true — mark 3, from the `'bound max'` name.
  **AMENDED 2026-09-07:** the rationale used to be mark 2, on the premise that a bound
  built-in loses the target's name from the source. That is V8's and SpiderMonkey's
  behavior rather than the language's — JavaScriptCore renders
  `'function max(){[native code]}'` for `Math.max.bind(null)` and for `Math.max` alike
  (probe A8, WebKit 26.5), so nothing is lost there. The verdict holds on every engine,
  because mark 3 carries it.
- `dIBF/A8` — `Array.bind(null)` → true — bound native constructor.
- `dIBF/A9` — `Proxy.bind(null)` → true — the subtraction tests for `name === 'Proxy'`; a
  bound `Proxy` is named `'bound Proxy'` and is therefore not subtracted.
- `dIBF/A10` — `plain.bind(null).bind(null)` → true — double-bound; `name` is
  `'bound bound plain'`.
- `dIBF/A11` — a bound CONSTRUCTABLE whose `name` was overwritten → true — mark 3 lost,
  mark 1 carries it alone. **AMENDED 2026-09-07:** mark 2 used to carry it too, which is
  why the same erasure on a NON-constructable target is now a rejection — see `dIBF/R10`.
- `dIBF/A12` — a cross-realm bound function and a cross-realm bound `Proxy` (`node:vm`) →
  true — no realm-fixed identity is consulted.
- ~~`dIBF/B1` — `Function.prototype` → true — **documented boundary**.~~ **WITHDRAWN
  2026-09-07:** it was admitted because mark 2 held on its own terms. With mark 2 unread
  and an empty `name`, it is rejected — see `dIBF/R11`. `Function.prototype` is not a
  bound function, so this boundary closed rather than moved.
- ~~`dIBF/B2` — a bare `Proxy` over a prototype-less callable → true — **documented
  boundary**.~~ **WITHDRAWN 2026-09-07:** the rationale was that a `Proxy` has no
  `[[SourceText]]` and so produces the anonymous native form honestly. That is a V8 and
  SpiderMonkey fact, not a language one — JavaScriptCore renders
  `'function ProxyObject(){[native code]}'`, and answered `false` where the others
  answered `true`. With mark 2 unread, a proxy is judged by the name it forwards: over an
  unbound callable it is rejected (`dIBF/R12`), over a BOUND one it is still admitted
  (`dIBF/A13`), which is the truthful reading in both cases.
- `dIBF/B3` — an arrow renamed to `'bound x'` → true — **documented boundary**. Mark 3 is
  forgeable; `name` is `configurable` on every function.
- `dIBF/B4` — a **named** native renamed to `'bound max'` → true — **documented boundary,
  and the shape mark 3 exists for**. Marks 1 and 2 both fail: no construct slot, and the
  source keeps the target's name (`'function max(){[native code]}'`), so it is not the
  anonymous form. The verdict therefore comes from mark 3 alone. On V8 the value is a
  forgery — a renamed `Math.max` is not bound. On an engine whose built-ins stringify
  identically bound or unbound, it is what a genuine bound built-in looks like, and mark 3
  is the only mark left that can admit it. Built in a `node:vm` realm so the rename cannot
  reach this realm's intrinsics.

**Rejects**

- `dIBF/R1` — a plain function, a class, a generator function → false — entrance-level
  (`X3`).
- `dIBF/R2` — an arrow, a concise method → false — prototype-less, but no mark holds.
- `dIBF/R3` — `Math.max`, `parseInt` → false — no construct slot past the entrance-level
  and no `'bound '` name. **AMENDED 2026-09-07:** the rejection used to be attributed to
  the source not being the anonymous form; it now follows from the two marks alone, which
  is why it holds on every engine rather than on the ones that render natives named.
- `dIBF/R4` — `Array`, `URL` → false — own `prototype`.
- `dIBF/R5` — the `Proxy` constructor → false — the only standard callable that is
  constructable with no own `prototype`, subtracted by `doesMatchProxyConstructor`.
- `dIBF/R6` — a cross-realm `Proxy` constructor → false — the subtraction is structural,
  not identity-based, so it recognizes a `Proxy` from any realm.
- `dIBF/R7` — a plain function renamed to `'bound y'` → false — owns a `prototype`; the
  rename never reaches a mark.
- `dIBF/R8` — a concise method whose body is the array literal `[nativecode]` → false —
  the condenser preserves the space inside `[native code]`, which real source cannot
  reproduce.
- `dIBF/R9` — a bare `Proxy` over a class → false — the proxy forwards the target's own
  `prototype`, so the entrance-level rejects it.
- `dIBF/R10` — a bound arrow, concise method or generator whose `name` was overwritten →
  false — **ADDED 2026-09-07, and the price of the amendment**. It never had a construct
  slot and the caller erased the only other mark, so nothing is left to read. It was
  admitted before only where the engine rendered anonymously, so it was never caught on
  JavaScriptCore. Contrast `dIBF/A11`, where the target IS constructable.
- `dIBF/R11` — `Function.prototype` → false — **ADDED 2026-09-07**, formerly `dIBF/B1`.
  Native and unnamed, and not a bound function.
- `dIBF/R12` — a bare `Proxy` over an unbound prototype-less callable → false — **ADDED
  2026-09-07**, formerly `dIBF/B2`. It forwards its target's ordinary `name`, and nothing
  about it says `bind`.

**Admits, added 2026-09-07**

- `dIBF/A13` — a `Proxy` over a BOUND function → true. It forwards the target's
  `'bound …'` name, and the value behind the proxy really is bound. This is the vector
  that keeps `dIBF/R12` from over-reaching, and the browser probes assert it on all three
  engines.

## `doesStronglyIndicateBoundFunction`

`doesStronglyIndicateBoundFunction(value?: unknown): boolean` — entrance-level, then mark
3 AND mark 2 AND mark 1. Ordered **cheapest-first**, the mirror of the cascade and for the
mirrored reason: a conjunction ends at the first mark that fails.

Mark 1 is applied **conditionally** —
`hasConstructSlot(value) ? !doesMatchProxyConstructor(value) : true`. A bound arrow,
concise method or generator never had a construct slot, so requiring one would reject half
the bound forms; what the clause contributes is the `Proxy` subtraction, which only bites
where a slot exists.

**Admits**

- `dSIBF/A1`–`A10` — every bound form admitted by `dIBF/A1`–`A10`, unchanged.
- `dSIBF/A11` — the cross-realm bound function and bound `Proxy` of `dIBF/A12` → true.
- `dSIBF/B1` — a `Proxy` that **also traps `name`** to report `'bound x'` → true —
  **documented boundary.** Every mark is satisfied: the source is anonymous native for
  free, and the trap supplies the name.
- `dSIBF/B2` — on an engine that renders a bound function's target name, a
  **non-constructable native renamed to `'bound '` plus its own rendered name** → true —
  **documented boundary, and the only admission this reading adds.**

  Such an engine renders a bound built-in and its unbound target as the same string, and
  the two agree on everything else a predicate may read: own `name`, own keys and their
  attributes, `length`, `[[Prototype]]`, and the absence of a construct slot. Nothing
  separates them, so admitting the genuine one admits the forgery with it. The only thing
  that would separate them is renaming the candidate and reading its source again, which a
  predicate may not do.

  **Accepted rather than closed, and this is where the module's grade is spent.** The
  alternative is to require a construct slot on that engine, which would refuse every
  bound arrow, concise method, generator and non-constructable native there — four
  ordinary shapes surrendered to block one forgery that a caller has to build
  deliberately, by renaming a native to impersonate its own bound form. The exposure does
  not reach user functions, which keep their authored source and fail mark 2 wherever they
  run.

  `concise` makes the opposite trade, because its law L3 forbids a false positive outright
  and its predicates are named `is…`. This module states no such law and names its exports
  `doesIndicate…`, which #088 defines as evidence rather than proof. The difference in the
  two names is exactly the difference in the two decisions.

**Rejects** — everything `doesIndicateBoundFunction` rejects, plus:

- `dSIBF/R10` — `Function.prototype` → false — anonymous and native, but its `name` is
  empty, so mark 3 fails.
- `dSIBF/R11` — an arrow renamed to `'bound x'` → false — mark 3 forged, but the source is
  still its own text, so mark 2 fails.
- `dSIBF/R12` — a bound function whose `name` was overwritten → false — **the recall
  price**. Mark 3 fails and there is no weaker gate to fall through to.
- `dSIBF/R13` — a **bare** `Proxy` over a prototype-less callable → false — it satisfies
  mark 2 honestly but forwards its target's `name`, failing mark 3.
- `dSIBF/R14` — the named native renamed to `'bound max'` of `dIBF/B4` → false **wherever
  a bound function renders anonymously**. Its source keeps the target's name, so mark 2
  fails and the value is refused; since it was never bound, that refusal is a precision
  gain. Where the engine renders the name instead, the same value is admitted rather than
  refused — that is `dSIBF/B2` above, and the reason the disagreement table is
  engine-relative.

## The engine split (added 2026-09-08)

`Function.prototype.toString` is implementation-defined for an exotic, so the conjunction
is built twice and dispatched per call. What follows specifies the three exports that
split creates. Their axis-1 coverage is asymmetric BY CONSTRUCTION, and the asymmetry is
stated rather than hidden: on any one engine only one reading is selected, so the other
cannot be exercised against real values there.

### `hasJavaScriptCoreBindBehavior(): boolean` — public

Reports whether this realm renders a bound function's target name into the native source
form. Takes no argument, memoizes after the first call, and reads no global — the probe is
a module-local function declaration, and every expectation is DERIVED from its own `name`
at call time so the minifier cannot break it.

- `hJSC/A1` — on V8 and SpiderMonkey → false; on JavaScriptCore → true. Engine-relative by
  definition, so it is asserted per engine by browser probe C1 and cross-checked against
  what the engine actually renders by B13.
- `hJSC/A2` — never throws, and answers `false` rather than propagating if the source
  readers do. It fails CLOSED: a hostile realm can withhold the JavaScriptCore reading, it
  cannot induce it — and inducing is the dangerous direction, since that reading admits a
  renamed native.

### `createExpectedJSCSpecificFunctionSourceFromBoundName(boundName: string): string` — `@internal`

Assembles the condensed source a name-rendering engine produces for a bound function, from
the `'bound '`-prefixed own name that engine derives it from. A pure string transform, so
every vector below runs on any engine.

- `cEJSC/A1` — `'bound plainTarget'` → `'function plainTarget(){[native code]}'`.
- `cEJSC/A2` — `'bound max'` → `'function max(){[native code]}'` — the string probe A8
  measured on WebKit 26.5 for `Math.max.bind(null)`.
- `cEJSC/A3` — `'bound bound plainTarget'` →
  `'function bound plainTarget(){[native code]}'` — **exactly one prefix is stripped**,
  which is what makes a double-bound value reconstruct correctly. Measured by A8, reasoned
  before that.
- `cEJSC/A4` — `'bound '` → the anonymous foundation. An empty remainder means an
  anonymous target, which every engine renders anonymously, so the form collapses rather
  than leaving a space where the name would be.
- `cEJSC/A5` — `'bound (){} evil'` → `'function (){} evil(){[native code]}'` — reassembled
  verbatim. The helper does not judge the name; the caller's precondition is mark 3.

### The two readings — `@internal`

`doesStronglyIndicateJSCSpecificBoundFunction` and
`doesStronglyIndicateNonJSCBoundFunction` share the entrance-level, mark 3 and the
conditional construct mark, and differ in mark 2 alone.

- `dSIBF/E1` — on a realm where `hasJavaScriptCoreBindBehavior()` is false, the public
  conjunction agrees with the non-JSC reading on EVERY corpus value. Asserted over the
  whole spec matrix, which is what makes the V8 suite a test of the selected reading
  rather than of a wrapper.
- `dSIBF/E2` — the JSC reading refuses every value that fails the entrance-level or mark
  3, on every engine, because mark 3 is a PRECONDITION there rather than the cheapest
  read. Engine-independent, therefore assertable on V8: `undefined`, a non-callable, a
  plain arrow and `Function.prototype` are all refused.
- `dSIBF/E3` — an arrow renamed `'bound …'` is refused by BOTH readings on every engine.
  Its own source text is no native form, so neither the anonymous comparison nor the
  reconstruction can match. The one forgery shape neither reading admits anywhere.
- **What the JavaScriptCore reading ADMITS cannot be asserted here.** Every value it
  accepts needs a rendered source only a name-rendering engine produces, so no vector in
  this file reaches one. That coverage sits outside the unit suite by necessity: Bun runs
  JavaScriptCore and selects this reading, so `smoke:check:bun` exercises those admissions
  on every push against the built module artifacts, and the browser matrix exercises them
  weekly against the UMD on WebKit. Said plainly here because a reader who finds no
  admission vectors above should know where they went, rather than conclude there are
  none.

## Relationship — the two predicates together

**Subset law (frozen).**
`doesStronglyIndicateBoundFunction(v) ⟹ doesIndicateBoundFunction(v)` for every `v`. This
is what the qualifier claims and it remains structural after the 2026-09-07 amendment: the
conjunction requires mark 3, and the cascade admits anything carrying it — which is true
of both readings, so the law survives the engine split as well. Verified with zero
violations over the corpus here, and asserted on every engine by browser probe B15.

**The disagreement set — three values, or four, depending on the engine.** The cascade
column is the same everywhere, because since #100 it reads only what the language
mandates. All the variation is in the conjunction, which reads the source.

| value                                                      | cascade | strong · renders anonymously | strong · renders the name |
| ---------------------------------------------------------- | ------- | ---------------------------- | ------------------------- |
| an arrow renamed `'bound x'`                               | true    | false                        | false                     |
| a bound CONSTRUCTABLE whose `name` was reset               | true    | false                        | false                     |
| a named native renamed `'bound max'`                       | true    | false                        | **true**                  |
| a `Proxy` over a BOUND function                            | true    | true                         | **false**                 |
| a bound value renamed AFTER binding to another `'bound …'` | true    | true                         | **false**                 |

So the set is **three** where a bound function renders anonymously — the first three rows,
which is what every vector in this file was executed against — and **four** where the
engine renders the target's name: row three leaves the set, and rows four and five join
it.

The three that hold everywhere are the intended trades. An arrow renamed to look bound is
precision gained, since its own source is no native form. A bound constructable whose name
was erased is recall lost, the price of requiring every mark. A named native renamed
`'bound max'` is the engine-relative one: a forgery the conjunction refuses where the
source still distinguishes it, and an admission it cannot refuse where the source does not
(`dSIBF/B2`).

The two that appear only on a name-rendering engine come from the same cause — there, the
expected source is RECONSTRUCTED from the own `name`, and both values carry a name the
engine did not use to render them. A `Proxy` forwards its target's `'bound …'` name while
the engine renders the proxy itself; a value renamed after binding keeps the name it was
given while the engine still renders the target's. Measured for the proxy (browser probe
C2); derived from A9's measurement for the rename, which established that a post-bind
rename does not move the rendered name.

Two values left the set entirely when the cascade stopped reading the source:
`Function.prototype` and a bare `Proxy` over a callable are now refused by both predicates
on every engine. Neither is a bound function, so the pair agreeing on `false` is the
correct outcome, not a lost distinction.

**The cascade degrades to a weaker answer; the conjunction degrades to silence** — that is
the choice a consumer makes between them.

**Engine dependence, and where it now lives.** The cascade has none: both marks it reads
are mandated by the language, so it answers identically everywhere. All remaining engine
dependence belongs to the conjunction, which reads the source.

`Function.prototype.toString` is implementation-defined for an exotic. JavaScriptCore
renders the bound target's name where V8 and SpiderMonkey render nothing, so the
conjunction is built twice and dispatched per realm. Measured, not cited: WebKit 26.5
renders `plain.bind(null)` as `'function plain(){[native code]}'`, and the effect is not
confined to built-ins — it reaches every bound value whose target carries a name. Before
the split, that made the conjunction reject essentially every bound value on that engine.

Rows three to five are the values that read differently by engine, and none of them can be
produced honestly under a single-engine runner. Row three is a forgery where the source
still distinguishes it and an unavoidable admission where it does not; `dIBF/B4` simulates
its shape, never its provenance, since only a name-rendering engine makes the two
collapse. Rows four and five do not diverge here at all — on this engine both predicates
admit them, and only a name-rendering engine separates them.

The engine claims behind all three now rest on `browser.probes.mjs` rather than on
observations recorded in comments: layer A records what each engine returns, and layer C
records what the library answers there.

## Helper specification (axis 4)

**Moved 2026-08-11 to [`UTILITY.spec.md`](./UTILITY.spec.md).** The four `#utility`
helpers this module composes from — `getCondensedFunctionSource`,
`getFunctionSourceCondensate`, `hasProxyConstructorShape`, `doesMatchProxyConstructor` —
are specified there, together with `CONDENSED_NATIVE_SOURCE_FOUNDATION`, under their
original vector identifiers (`gCFS/*`, `gFSC/*`, `hPCS/*`, `dMPC/*`) and with their
verdicts unchanged.

They left this file because they stopped belonging to one consumer: `concise` now imports
`getFunctionSourceCondensate` and the constant, so helper contracts specified inside the
`bound` spec would have made one module's spec a dependency of another's. This mirrors
type-detection, where `utility` has always had its own spec. See Resolved item 6.

## Throw-safety (axis 5) — completeness oracle

Two exports carry `@@throw-safe`, in both files of the pair:

| export                              | `.js` | `.d.ts` |
| ----------------------------------- | ----- | ------- |
| `doesIndicateBoundFunction`         | ✓     | ✓       |
| `doesStronglyIndicateBoundFunction` | ✓     | ✓       |

The axis-5 suite asserts the triple-lock: the markers found in source ⟺ the set declared
in `test/bound/__config.js` (`THROW_SAFE_MARKED`) ⟺ the set actually exercised. Both
parameters are `unknown`, so the hostile set is unrestricted — `null`, `undefined`,
primitives, a revoked `Proxy`, proxies with throwing `getOwnPropertyDescriptor` / `get` /
`ownKeys` traps, a function with an accessor `name` that throws, a null-prototype object.

`#utility`'s four marked exports are scored by `test/utility/__config.js` and specified in
[`UTILITY.spec.md`](./UTILITY.spec.md); the parser is given one module path at a time, so
the sets never merge.

Verified before freezing: no throws across the marked set.

## Resolved items

1. **`@@throw-safe` for a narrowed parameter (2026-08-06).** Undefined by the repo's
   conventions until now, and the one apparent precedent is accidental — type-detection's
   `getFunctionSource` is total out-of-contract only because of a `try`/`catch` added on
   the mistaken belief that a genuine callable could make `toString` throw. Settled above
   as in-contract totality, with the declared type as the enforcement. No runtime guard
   was added: `#utility` is reachable only from typechecked in-package callers, and a
   runtime check for a compile-checked precondition duplicates the type system.
2. **The disagreement set is four, not three (corrected in #088, 2026-08-06).** The ADR
   first stated three, omitting the bare `Proxy` and so understating the conjunction's
   benefit. The exhaustive enumeration required to write this spec produced four; #088's
   Consequences now match. **Superseded by item 5 — the count is five as of 2026-08-07.**
3. **The `[[Construct]]` mark is conditional in the strict predicate**, not required, and
   this is deliberate — see `doesStronglyIndicateBoundFunction` above. Reading it as an
   inconsistency with the cascade is the expected misreading.
4. **`bound/X6` appended 2026-08-06 — the bind-closure exception.** Writing the standing
   invariants produced a law ("binding any callable yields a value both predicates admit")
   that turned out false, with exactly one standard counterexample. The vector and its
   mechanism are above; the law and its asserted exception live in
   `test/bound/invariants.test.js`. **Append, not amendment** — no existing verdict
   changed, so the FROZEN 2026-08-06 oracle stands. The general fact belongs to
   `isFunction` rather than to this module and was appended to type-detection's
   `FUNCTION.spec.md` as `isFunction/R3` the same day.
5. **Mark 3 had no justifying vector (added 2026-08-07).** Every vector in which mark 3
   decided was a forgery (`dIBF/B3`), so the suite pinned the mechanism but never the
   purpose — and the spec named no engine anywhere, though both source files did. Not a
   correctness hole; the risk was **directional**. Mark 3's only guard asserted "an arrow
   renamed to look bound is admitted". A maintainer trimming spoofable behaviour would
   read that test's failure as endorsing the removal rather than blocking it. `dIBF/B4`
   and `dSIBF/R14` close the gap, and the disagreement set becomes five. **Amendment, not
   an append** — "exactly four" was a frozen claim in the Relationship section and is now
   corrected, as is #088's Consequences.
6. **Axis-4 helpers and the `#utility` half of axis 5 moved out (2026-08-11).** They were
   written here because `bound` was the only consumer; `concise` became the second, which
   was the recorded trigger for a standalone [`UTILITY.spec.md`](./UTILITY.spec.md). **A
   move, not a re-derivation** — all eighteen vectors keep their identifiers and verdicts.
   None was re-executed to justify the relocation, since they are already the live oracle
   of the committed `test/utility/` suite. The axis-5 table was additionally **wrong to be
   merged here at all**: it listed six exports as this module's marked set, while
   `test/bound/__config.js` has always scored only its own two. The split brings the spec
   back in step with the test architecture rather than changing either. The marker
   contract for a narrowed parameter (Module contract, Resolved item 1) stays here as
   package policy, cited from `UTILITY.spec.md` rather than duplicated.

7. **The cascade stopped reading the function source (2026-09-07).** The first amendment
   here to change verdicts rather than add or move them. Reasoning in full: ADR #100.

   The short version. Mark 2 asks whether a value stringifies as an anonymous native
   function. Bound functions do — and so does every callable `Proxy`, and so does
   `Function.prototype`. As a positive mark in a disjunction it therefore admitted values
   that were never bound, and it was also the one input this predicate had that engines
   spell differently. Removing it costs one case and buys three.

   What flipped: `dIBF/B1` and `dIBF/B2` withdrawn (now `dIBF/R11` and `dIBF/R12`),
   `dIBF/R10` added as the price, `dIBF/A13` added as the vector that keeps `R12` honest,
   `dIBF/A11` narrowed to constructable targets, and the disagreement set reduced from
   five to three.

   **Why this could not have been decided in August.** The old text called the engine
   dependence "not testable here" and reasoned about it from a comment.
   `browser.probes.mjs` now executes it in three engines, and its answer was bigger than
   the note assumed — on JavaScriptCore mark 2 misses every bound value whose target has a
   name, not only built-ins. A decision resting on measurement replaced one resting on an
   anecdote.

   **Amendment, not an append** — `dIBF/B1`, `dIBF/B2` and the "exactly five" count were
   frozen claims and are now corrected, with the withdrawn vectors kept visible and struck
   through rather than deleted (#054).

   **Rationale sweep, same amendment.** The first pass corrected every vector whose
   VERDICT changed and left behind four places that merely CITED the removed mark:
   `dIBF/A4`, `A6` and `A7` credited mark 2 with carrying them, and the Module contract
   still framed the mark list as the cascade's trial order. All four are corrected above
   and no verdict among them moves. `A7` was the one worth the trouble: its premise — that
   a bound built-in loses the target's name from the source — is not merely stale but
   false on JavaScriptCore, which is the engine the amendment exists for.

8. **The engine split is finished, and the boundary it adds is accepted (2026-09-08).**
   The 2026-09-07 amendment changed how the module reads a bound function; this one
   records what that left standing.

   Four exports arrived with the split and are now in the surface inventory, one of them
   published. The two readings and the reconstruction helper carry contracts and vectors,
   and the reconstruction helper — a pure string transform that runs the same everywhere —
   is exercised directly, which it had not been.

   The substantive decision is `dSIBF/B2`. On an engine that renders a bound function's
   target name, a non-constructable native renamed to impersonate its own bound form is
   admitted, because that engine leaves nothing to tell the two apart. **We keep it.**
   Closing it means requiring a construct slot there, which costs every bound arrow,
   concise method, generator and non-constructable native on that engine — four ordinary
   shapes lost to block one forgery a caller must build on purpose. A predicate named
   `doesIndicate…` reports evidence, and evidence a caller has forged is still, honestly
   reported, evidence. `concise` decides the same question the other way because its law
   forbids a false positive; the two modules differ in their names and therefore in their
   answers.

   `dSIBF/R14` is corrected in the same pass. It read as a rejection on every engine,
   which the split made untrue: on a name-rendering engine the value is admitted, and that
   is `dSIBF/B2`. **A correction, not a new verdict** — nothing changes where a bound
   function renders anonymously, which is where every vector in this file was executed.
