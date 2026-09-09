// @ts-check

/**
 * @module @species-js/type-identity
 *
 * The published surface — every export the package documents as part of its
 * contract, named one by one.
 *
 * Curation is the point. `src/index.js` additionally exports the two parameter
 * verifiers and the error-cause seam, so the suite can assert their admissions
 * and refusals directly rather than only through an entry's rejection order; it
 * stays that way because `#index` is what the suite imports. This file is what
 * `package.json`'s `exports["."]` resolves to, so a consumer reaches only what
 * is listed below.
 *
 * The tag is not the boundary. `@internal` is documentation that no resolver
 * reads — this list is the enforcement, and `scripts/check-public-surface.mjs`
 * fails the build when the two disagree (ADR #099).
 *
 * Re-export order carries nothing here. The package has one module, and its
 * only load-time work is the error-cause capability probe, which depends on no
 * binding in this file.
 */

export {
  brandFunctionName,
  defineStableTypeIdentity,
  doesCarryStableTypeIdentity,
} from '#index';
