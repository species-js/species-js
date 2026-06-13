# 001 — Branding rejected for type-name string aliases

**Date:** 2026-05-29

**Context.** `ConstructorName`, `TaggedType`, and `ResolvedType` carry runtime string
values. A brand-style declaration
(`type ConstructorName = string & { __brand: 'ConstructorName' }`) was considered to give
them nominal distinctness in TypeScript.

**Decision.** Reject branding. The three are plain `type X = string` aliases, with
provenance carried by producers' return types and `{@link}` cross-references in JSDoc.

**Rationale.** Brand the type only when same-shaped values must not be interchanged across
a directional flow (`UserId` vs `OrderId`). The three names here frequently coincide at
runtime — `'Array'` is both the constructor name and the tagged type for an array — and
`ResolvedType` is the union of the other two _because_ callers treat them as one
"type-name string." The brand would be a fiction asserted over plain `String#slice` and
`.name` output. Brands cannot carry runtime provenance anyway; if that ever becomes a
requirement, a discriminated union is the right shape, not a brand.

**Consequences.** The ruling applies recursively to function shapes. `ES3Function`,
`ClassConstructor`, `AsyncFunction`, and the generator-family interfaces are structural
types, not branded shapes. Nominal-identity machinery is the sibling
`@species-js/type-identity` package's concern; type-detection does not improvise brands.
