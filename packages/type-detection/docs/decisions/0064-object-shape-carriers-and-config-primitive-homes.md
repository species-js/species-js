# 064 — The three object-shape carriers; config-level primitive homes

**Date:** 2026-07-05

> **Partially superseded 2026-07-29 (config round).** The `BLANK_TYPE` carrier constant
> introduced by this decision was removed as an unconsumed export — `@internal`, with zero
> consumers anywhere in the package. `BlankType` the _type_ remains (it composes
> `BlankDictionary`); it simply no longer has a value carrier, so the `BlankType` row's
> "carrier" column below now reads `—`. The three-shape TYPE taxonomy is otherwise intact.
> Rationale in the config-round `CONFIG.spec.md` reconciliation.

**Context.** A cleanup pass — "unify the basic object and function shapes and constants
that are essential at config-level" — surfaced how scattered and imprecise the
prototype-less-object types and their constants had become:

- `DictionaryObject` was referenced from `@/object` (its predicate `isDictionaryObject`,
  the `PlainOrDictionaryObject` union) but defined in `@/config`, leaving `@/object`
  pointing at a name it no longer declared and creating a mutual `config ↔ object`
  type-cycle (config imported `AnyObject` from object; object needed `DictionaryObject`
  from config).
- `BlankType` (`Record<PropertyKey, never>`) was documented as living "in `@/utility`"
  (#017 / #034 / #040) yet was actually defined in `@/config` and imported from a location
  that never exported it — a dangling reference in `@/utility`, `@/thenable`, `@/evented`.
- `BlankDictionary` was broken: `DictionaryObject<BlankType>` against a non-generic
  interface.
- The `DictionaryObject` interface carried a `prototype: null` member — a category error:
  a plain object has no own `prototype` property (that is a function-only slot); its
  runtime `prototype` reads back `undefined`, so the member misdescribed the value.
- `objectCreate(null)`'s retyped return was documented as
  `Record<PropertyKey, never> & { prototype: null; constructor?: never }` rather than a
  named type; `BLANK_DICTIONARY` was typed `BlankDictionary` via an illegal ambient
  initializer.
- `INSTANCE_LESS_CONSTRUCTOR` (#060) was defined in BOTH `@/config` and `@/utility` — two
  distinct function identities, with `@/utility`'s the live one and `@/config`'s dead —
  and the failure surrogate of `getValidatedStandardConstructorAndPrototypeTuple` mistyped
  its blank slot as `BlankType` rather than the `BLANK_DICTIONARY` it actually returns.

The unifying question (user-led): what are the _honest_ distinct shapes, where do they
belong, and what single constant carries each.

**Decision.** Formalize THREE distinct prototype-shape carriers, distinguished along two
axes — whether a prototype-chain exists, and whether own keys may be present:

| Type               | `[[Prototype]]`    | `constructor` | own keys | carrier            | home       |
| ------------------ | ------------------ | ------------- | -------- | ------------------ | ---------- |
| `DictionaryObject` | `null`             | absent        | OPEN     | —                  | `@/object` |
| `BlankType`        | `Object.prototype` | `Object`      | EMPTY    | `BLANK_TYPE`       | `@/config` |
| `BlankDictionary`  | `null`             | absent        | EMPTY    | `BLANK_DICTIONARY` | `@/config` |

- `DictionaryObject` = `AnyObject` + `constructor?: never`; the honest return of
  `objectCreate(null)` and the narrow target of `isDictionaryObject`. Homed in `@/object`
  beside its predicate and its `extends AnyObject` base.
- `BlankType` = `Record<PropertyKey, never>` — a real `Object`, merely empty. Homed in
  `@/config`; new constant `BLANK_TYPE` (`= {}`).
- `BlankDictionary` = `BlankType & { constructor?: never }` — the intersection: a
  prototype-less, empty `Object.create(null)`. Homed in `@/config`; carried by
  `BLANK_DICTIONARY`.

Concrete rulings:

1. `objectCreate: { (o: null): DictionaryObject; … }`. `BLANK_DICTIONARY: BlankDictionary`
   (`.d.ts` declaration without initializer; the `.js` narrows the `objectCreate(null)`
   result via cast). The `getValidatedStandardConstructorAndPrototypeTuple` failure
   surrogate `[INSTANCE_LESS_CONSTRUCTOR, BLANK_DICTIONARY]` is typed
   `[…, BlankDictionary]`.
2. `INSTANCE_LESS_CONSTRUCTOR` homed in `@/config` as the single realm-fixed identity;
   `@/utility`'s duplicate removed; `@/utility` / `@/thenable` / `@/evented` import it
   from `@/config`.
3. Type-graph direction is one-way `config → object`: config imports `DictionaryObject`
   from object; object imports nothing from config. The interim mutual cycle is gone.
4. `prototype: null` removed from `DictionaryObject`; `constructor?: never` is the sole
   type-expressible discriminator from `PlainObject` (`constructor: ObjectConstructor`).

**Rationale.** The old model conflated two independent axes: it called `BlankType` "the
sentinel form of a prototype-less object", but its runtime carrier `{}` is
prototype-_bearing_. Separating "prototype-less" (expressed by `constructor?: never`) from
"empty own surface" (expressed by `Record<PropertyKey, never>`) names each carrier
honestly and makes `BlankDictionary` fall out as their intersection. What TypeScript
cannot express — the `[[Prototype]]` slot itself — is documented, not faked (the removed
`prototype: null` was exactly such a fake).

Placement follows use: `DictionaryObject` belongs with the predicate that narrows to it
and the `AnyObject` it extends (`@/object`); `BlankType` / `BlankDictionary` belong with
the `BLANK_TYPE` / `BLANK_DICTIONARY` constants that instantiate them (`@/config`). This
placement is also what makes the type graph acyclic — a single `config → object` edge
instead of the interim mutual pair — which the user confirmed is achievable without a
loading problem (type-only imports carry no runtime cycle).

One `INSTANCE_LESS_CONSTRUCTOR` identity is a correctness property, not a tidiness one:
the sentinel is compared by identity (`X !== INSTANCE_LESS_CONSTRUCTOR` gates the
cross-realm branch), so two copies are a latent identity-mismatch landmine. `@/config` is
its natural home — a realm-fixed function-shape primitive of the same tier as
`BLANK_DICTIONARY`.

**Consequences.** New `@/config` export `BLANK_TYPE`; `@/config` gains the `BlankType` /
`BlankDictionary` type exports; `DictionaryObject` remains exported from `@/object`
(single definition). `@/utility` no longer defines or exports `INSTANCE_LESS_CONSTRUCTOR`
(imports it from `@/config` for the surrogate tuple); `@/thenable` / `@/evented` likewise
import it from `@/config`. No behavioral vector changed — this is a type / identity /
documentation consolidation; the `INSTANCE_LESS_CONSTRUCTOR` unification is
identity-relevant to the realm-membership guards but observationally equivalent (single
identity everywhere), pending the suite re-run.

Supersedes the LOCATION claims of #017 / #034 / #040 (`BlankType` "in `@/utility`";
`objectCreate(null) → Record<PropertyKey, never>`) and #060 (`INSTANCE_LESS_CONSTRUCTOR`
in `@/utility`). Those ADRs stand as the historical record; this decision relocates and
retypes. Current-state docs updated: `architecture/object.md` (cross-module section
rewritten to the three-carrier taxonomy), `UTILITY.spec.md` (type-export tally corrected —
`BlankType` removed as a non-`@/utility` type, `WeakKey` / `PredicateFunction` added, 8 →
9).

Builds on #017 (dictionary-object detection), #034 (boundary-retyping at `@/config` for
`objectCreate`), #040 (object-module structural subtype hierarchy), #060
(`INSTANCE_LESS_CONSTRUCTOR` sentinel).

Commit: _pending_.
