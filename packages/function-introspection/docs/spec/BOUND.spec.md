# bound — behavioral specification

> Spec format and the multi-axis model are defined in
> [type-detection's spec README](../../../type-detection/docs/spec/README.md); this
> package follows the same model and does not restate it. Vectors are reasoned from the
> canon (`bound.js`, `bound.d.ts`, `utility/index.{js,d.ts}`, decisions #087 and #088).
> Status: **FROZEN 2026-08-06 · AMENDED 2026-08-07 · AMENDED 2026-08-11** — decidability
> check passed: every vector below was executed against the real predicates through the
> `#index` barrel before freezing, including the cross-realm pairs (`node:vm`) and the two
> forgery shapes. This spec is the base for the axis-1 suite; axes 2–5 derive alongside.
>
> The 2026-08-07 amendment adds `dIBF/B4` and `dSIBF/R14` — the shape mark 3 exists for,
> which no vector had covered — and corrects the disagreement set from four values to
> five. No existing verdict changed. See Resolved item 5.
>
> The 2026-08-11 amendment **moves the axis-4 helper section and the `#utility` half of
> the axis-5 table out to [`UTILITY.spec.md`](./UTILITY.spec.md)**, now that `concise` is
> a second consumer of those helpers. No vector was re-derived, no verdict changed, and
> every identifier is unchanged at the new location. See Resolved item 6.

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

The three marks, in the order the cascade tries them:

1. **`[[Construct]]`** — a construct slot, with the `Proxy` constructor subtracted.
2. **Anonymous native source** — the condensed source equals
   `'function(){[native code]}'`.
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

| Export                               | Module     | Visibility  | `@@throw-safe` |
| ------------------------------------ | ---------- | ----------- | -------------- |
| `doesIndicateBoundFunction`          | `#bound`   | public      | yes            |
| `doesStronglyIndicateBoundFunction`  | `#bound`   | public      | yes            |
| `getCondensedFunctionSource`         | `#utility` | public      | yes            |
| `getFunctionSourceCondensate`        | `#utility` | `@internal` | yes            |
| `hasProxyConstructorShape`           | `#utility` | `@internal` | yes            |
| `doesMatchProxyConstructor`          | `#utility` | `@internal` | yes            |
| `CONDENSED_NATIVE_SOURCE_FOUNDATION` | `#utility` | `@internal` | n/a (constant) |
| `globalContext`                      | `#config`  | `@internal` | n/a (constant) |
| `getOwnPropertyDescriptors`          | `#config`  | `@internal` | n/a (capture)  |

Only `doesIndicateBoundFunction`, `doesStronglyIndicateBoundFunction` and
`getCondensedFunctionSource` reach a consumer; `#utility` and `#config` are re-exported
nowhere and published as no subpath (#085's barrel rule).

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
mark 2 OR mark 3, in that order. Ordered by **decisiveness**, because any mark ends the
question.

**Admits**

- `dIBF/A1` — `plain.bind(null)` → true — all three marks.
- `dIBF/A2` — `plain.bind(null, 1)` → true — partial application changes `length`, not the
  marks.
- `dIBF/A3` — `K.bind(null)` (bound class) → true — construct slot preserved.
- `dIBF/A4` — `(() => {}).bind(null)` → true — no construct slot; carried by marks 2
  and 3.
- `dIBF/A5` — `obj.concise.bind(null)` → true — same shape as A4.
- `dIBF/A6` — `(function* () {}).bind(null)` → true — generator functions have no
  construct slot, so again marks 2 and 3.
- `dIBF/A7` — `Math.max.bind(null)` → true — a bound built-in loses the target's name from
  the source, satisfying mark 2.
- `dIBF/A8` — `Array.bind(null)` → true — bound native constructor.
- `dIBF/A9` — `Proxy.bind(null)` → true — the subtraction tests for `name === 'Proxy'`; a
  bound `Proxy` is named `'bound Proxy'` and is therefore not subtracted.
- `dIBF/A10` — `plain.bind(null).bind(null)` → true — double-bound; `name` is
  `'bound bound plain'`.
- `dIBF/A11` — a bound function whose `name` was overwritten → true — mark 3 lost, marks 1
  and 2 carry it.
- `dIBF/A12` — a cross-realm bound function and a cross-realm bound `Proxy` (`node:vm`) →
  true — no realm-fixed identity is consulted.
- `dIBF/B1` — `Function.prototype` → true — **documented boundary**. Genuinely anonymous
  and genuinely native, so mark 2 holds on its own terms.
- `dIBF/B2` — a bare `Proxy` over a prototype-less callable → true — **documented
  boundary**. A `Proxy` has no `[[SourceText]]`, so it produces the anonymous native
  source honestly. No handler is involved.
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
- `dIBF/R3` — `Math.max`, `parseInt` → false — native but named, so the source is
  `'function max(){[native code]}'`, not the anonymous form.
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
  **documented boundary, and the only one that survives the conjunction**. Every mark is
  satisfied: the source is anonymous native for free, and the trap supplies the name.

**Rejects** — everything `doesIndicateBoundFunction` rejects, plus:

- `dSIBF/R10` — `Function.prototype` → false — anonymous and native, but its `name` is
  empty, so mark 3 fails.
- `dSIBF/R11` — an arrow renamed to `'bound x'` → false — mark 3 forged, but the source is
  still its own text, so mark 2 fails.
- `dSIBF/R12` — a bound function whose `name` was overwritten → false — **the recall
  price**. Mark 3 fails and there is no weaker gate to fall through to.
- `dSIBF/R13` — a **bare** `Proxy` over a prototype-less callable → false — it satisfies
  mark 2 honestly but forwards its target's `name`, failing mark 3.
- `dSIBF/R14` — the named native renamed to `'bound max'` of `dIBF/B4` → false — mark 2
  fails. On V8 that rejection is a precision gain, because the value is not bound. On an
  engine that keeps the name in the native source form, the identical rejection is a
  **recall loss on a genuinely bound built-in**. One vector, read either way depending on
  the engine — which is why the disagreement table below is engine-relative.

## Relationship — the two predicates together

**Subset law (frozen).**
`doesStronglyIndicateBoundFunction(v) ⟹ doesIndicateBoundFunction(v)` for every `v`. This
is what the qualifier claims and it is structural: identical entrance-level, and a
conjunction of the same three marks cannot admit what a disjunction of them rejects.
Verified with zero violations over the 38-value corpus.

**The disagreement set — exactly five values**, all in the same direction:

| value                                   | cascade | strong | why the divergence is intended                   |
| --------------------------------------- | ------- | ------ | ------------------------------------------------ |
| `Function.prototype`                    | true    | false  | precision gained — empty `name` fails mark 3     |
| an arrow renamed `'bound x'`            | true    | false  | precision gained — own source fails mark 2       |
| a **bare** `Proxy` over a callable      | true    | false  | precision gained — forwarded `name` fails mark 3 |
| a bound function whose `name` was reset | true    | false  | recall lost — the price of requiring every mark  |
| a named native renamed `'bound max'`    | true    | false  | engine-relative — see below                      |

**The cascade degrades to a weaker answer; the conjunction degrades to silence** — that is
the choice a consumer makes between them.

**Engine dependence.** The first four rows read the same on every engine: three precision
gains and one recall cost. The fifth does not, because mark 2 asks whether the source is
the ANONYMOUS native form. On V8 a bound built-in loses its target's name there, so mark 2
always holds and **mark 3 never decides** — every value that fires mark 3 has already
fired mark 2, and the cascade short-circuits first. On an engine whose built-ins stringify
identically bound or unbound, mark 2 fails for genuinely bound built-ins and mark 3 is the
only mark that can admit them. That is why it exists.

The consequence is concrete: **on such an engine `doesStronglyIndicateBoundFunction`
rejects genuinely bound built-ins.** Both `bound.js` and `bound.d.ts` state this; it is
recorded here because the spec is the oracle, and the table alone reads as
engine-independent.

`dIBF/B4` simulates the shape, not the provenance — a single-engine runner cannot produce
the real value. It pins the decision path (marks 1 and 2 fail, mark 3 admits), not the
engine claim, which rests on the three-browser observation recorded in `bound.js`.

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
