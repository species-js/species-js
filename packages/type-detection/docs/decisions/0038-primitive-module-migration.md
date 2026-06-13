# 038 — Primitive module migration: full surface across five families

**Date:** 2026-06-07

**Context.** The `@species-js/type-detection/primitive` module had shipped as a stub
during the early-scaffolding rounds: 5 `typeof`-based value predicates (`isStringValue`,
`isNumberValue`, `isBooleanValue`, `isSymbolValue`, `isBigIntValue`) and zero types. Boxed
coverage and composite predicates were intentionally deferred — the stub was sized for
what other migrated modules immediately needed (descriptor reads, `typeof` checks for
value-narrowing) rather than for the full primitive-discrimination surface. The equip-js
source had a richer surface: 5 boxed types, 5 composite types, 5 boxed predicates, and 5
composite predicates, in addition to the value-only set. The migration question was
whether to port the full surface and, if so, how to reshape the boxed-predicate marker
chain for species-js conventions.

**Decision.** Ship the full surface — 15 types and 15 predicates across the five primitive
families (`string`, `number`, `boolean`, `symbol`, `bigint`). Per family:

- `XValue` — type alias for the built-in primitive (e.g. `StringValue = string`).
- `BoxedX` — boxed wrapper-object type (e.g. `BoxedString = String & object`); the
  `& object` intersection is the load-bearing distinction from the primitive form.
- `XType` — composite union (`XValue | BoxedX`).
- `isXValue` — primitive form via `typeof`.
- `isBoxedX` — boxed form via three cross-validating structural markers (see #039 for the
  marker-chain design).
- `isX` — composite predicate via `isXValue || isBoxedX`, short-circuit with the cheaper
  primitive check first.

**Boxed-predicate marker chain.** Three markers compose, ordered performance-first:
`typeof value === 'object'` (O(1) primitive-rejection gate), then the `[[Class]]` tag read
(e.g. `getTypeSignature(value) === '[object String]'`, cross-realm-safe via the
realm-fixed `toObjectString.call` capture), then the constructor-name walk (e.g.
`getDefinedConstructorName(value) === 'String'`, cross-realm-safe via the four-source
fallback). The chain mirrors the structural-gate-then-identity-markers pattern from
`isPromise` (#023) and `isEventTarget` / `isAbortSignal` (#028): a fast structural gate,
then two realm-independent identity refinements. The three markers form the
conservative-narrowing posture (#010) — bounded-cost insurance against single-marker
`Symbol.toStringTag` spoofing.

The `typeof === 'object'` gate runs first because it's the cheapest and the most
discriminating against typical inputs (primitives, `undefined`, functions all reject in
O(1)). `null` is admitted by the `typeof` gate but rejected by the tag check via
`'[object Null]'`. The constructor walk is the most expensive step but provides the final
cross-validator against spoofed tags.

**Wrapper-object types.** The boxed types (`BoxedString = String & object`,
`BoxedNumber = Number & object`, etc.) intentionally use the TypeScript wrapper-object
types as the load-bearing distinction from the primitive form. The
`@typescript-eslint/no-wrapper-object-types` rule's default advice ("prefer the primitive
`string` over `String`") is correct for typical code but wrong here: this is precisely the
case where the wrapper-object type is the structural model. Added a per-file ESLint
override scoped to `**/src/primitive.d.ts`, with rationale, matching the existing
override-with-rationale style in `eslint.config.js`. Per the zero-`eslint-disable` policy
([[quality-discipline]]), the fix is configuration at the right level, not inline
suppression.

**File-level structure.** Per-family sectioning (types and predicates for one family
grouped together) over types-then-predicates. The five families are independent
(string-discrimination doesn't compose with number-discrimination), so reader-locality
wins over cross-family grouping. The family order follows the ECMA-262 `typeof`
return-value order (`string`, `number`, `boolean`, `symbol`, `bigint`) which has
structural meaning, not the stub's roughly-alphabetical order.

**Rationale.** Foundation-tier completeness for the primitive module: now that the
function / thenable / evented / error modules have all migrated, the primitive module is
the last incomplete corner of `type-detection`. The boxed coverage is the structurally
honest extension — every JavaScript primitive has a boxed wrapper form reachable via
`Object(...)` or `new String(...)` etc., and discriminating them is a real need for any
code that handles user input or cross-realm values. The composite predicates (`isString`,
`isNumber`, etc.) admit both forms transparently for the common case where the distinction
doesn't matter.

**Consequences.** Public surface: 5 value types, 5 boxed types, 5 composite types, 5 value
predicates, 5 boxed predicates, 5 composite predicates — 30 exports total. Cross-module:
the value-only predicates (already used by `@/utility`, `@/error`, etc.) keep their
signatures (now generic, see #039). The boxed and composite predicates are new public
surface for downstream consumers. ESLint config gains one per-file override. The full
type-detection package's primitive-discrimination ceiling is now reached; further
extensions would belong in a different module (e.g. nominal branding in
`@species-js/type-identity`).

Commit `5c5dbe7`. See `../architecture/primitive.md` for the conceptual map.
