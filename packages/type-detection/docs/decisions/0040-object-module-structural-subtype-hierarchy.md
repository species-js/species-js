# 040 — Object module: structural subtype hierarchy over branding

**Date:** 2026-06-06

**Context.** The equip-js source's object module distinguished three types (`AnyObject`,
`PlainObject`, `DictionaryObject`) via a `__objectBrand__: unique symbol` discriminator on
each. The brand was structural fiction:

- No `__objectBrand__` property exists at runtime.
- The predicates cannot verify the brand because nothing in the runtime carries it.
- The brand forced the three types into _sibling_ positions, when the natural relationship
  is a _subtype hierarchy_: every PlainObject IS an AnyObject; every DictionaryObject IS
  an AnyObject; PlainObject ⊥ DictionaryObject (mutually exclusive at runtime by
  prototype, not by brand).

The migration question was whether to port the brand verbatim or replace it with a
structurally-honest discriminator.

**Decision.** Replace the brand with the actual structural discriminator — the
`constructor` property — which matches both the runtime discriminator and the natural
subtype hierarchy:

- `AnyObject = object & Record<PropertyKey, unknown>` — floor type: any non-null,
  non-function object. The intersection with `Record` gives narrowed values arbitrary
  property-access ergonomics; `object` carries the "non-primitive" constraint.

- `PlainObject extends AnyObject` adds `constructor: ObjectConstructor` — the
  structurally-honest constraint matching the runtime test
  `getPrototypeOf(value) === Object.prototype`. Required `constructor` of the specific
  `ObjectConstructor` type.

- `DictionaryObject extends AnyObject` adds `constructor?: never` — optional property
  typed as `never`, meaning "either absent or, if present, of type never." This is the
  type-level reflection of the runtime characteristic "no prototype chain"
  (`getPrototypeOf(value) === null` and `getDefinedConstructor(value) === undefined`).
  Disjoint from `PlainObject` at the type level: any attempt to assign a value with
  `constructor: ObjectConstructor` to `DictionaryObject` fails (since `ObjectConstructor`
  is not `never`).

The brand is gone; the discrimination is structurally honest.

**Rationale.** Three forces converge:

- **Structurally-honest discrimination.** The actual runtime distinction between
  `PlainObject` and `DictionaryObject` IS the constructor's presence and identity.
  Modeling that at the type level via `constructor: ObjectConstructor` /
  `constructor?: never` makes the type-level discrimination match the runtime
  discrimination — both encode the same fact.

- **Natural subtype hierarchy.** Both refinements are subtypes of `AnyObject`, which
  TypeScript can express directly via `interface X extends AnyObject`. The equip-js
  branding fought this — its sibling positioning was structurally incorrect and required
  explicit casts to navigate. The hierarchy form requires no casts.

- **Aligns with decision #001.** That decision rejected branding for type-name string
  aliases (`ConstructorName`, `TaggedType`, `ResolvedType`) on the grounds that brands are
  appropriate only when same-shaped values must not be interchanged across a directional
  flow. The equip-js object branding suffered the same diagnosis: the three types were
  structurally distinct via constructor, not via any hidden tag. Brands cannot carry
  runtime provenance, so a brand here was both fictional AND redundant.

**Consequences.** Public surface: `AnyObject`, `PlainObject`, `DictionaryObject`,
`isObject`, `isPlainObject`, `isDictionaryObject`. The `BoxedString` / `BoxedNumber` /
etc. types from `@/primitive` use the structural intersection pattern (`String & object`)
which is a structurally-similar precedent — distinguishing the boxed form via the specific
wrapper-class intersection rather than via a brand. The `@/utility`'s `BlankType`
(`Record<PropertyKey, never>`) is the sentinel form of the same runtime carrier as
`DictionaryObject` (`Record<PropertyKey, unknown>` + discriminator); per TypeScript
variance, `BlankType` is a structural subtype of `DictionaryObject`. The relationship is
cross-referenced in both modules' JSDoc.

Commit `8e09b21`. See decision #041 for the lodash semantic divergence and
`../architecture/object.md` for the conceptual map.
