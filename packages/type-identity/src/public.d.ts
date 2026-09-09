/**
 * @module @species-js/type-identity
 *
 * The published surface — every export the package documents as part of its
 * contract, named one by one.
 *
 * Curation is the point. `src/index.d.ts` additionally declares four
 * `@internal` exports — the two parameter verifiers, the error-cause seam and
 * its `ErrorWithCauseConstructor` type — so the suite can assert their
 * admissions and refusals directly rather than only through an entry's
 * rejection order; it stays that way because `#index` is what the suite
 * imports. This file is what `package.json`'s `exports["."]` resolves to, so a
 * consumer reaches only what is listed below.
 *
 * The tag is not the boundary. `@internal` is documentation that no resolver
 * reads — this list is the enforcement, and `scripts/check-public-surface.mjs`
 * fails the build when the two disagree (ADR #099).
 */

export {
  brandFunctionName,
  defineStableTypeIdentity,
  doesCarryStableTypeIdentity,
} from '#index';

export type {
  IdentityDefinitionFailure,
  IdentityDefinitionResult,
  IdentityDefinitionSuccess,
} from '#index';
