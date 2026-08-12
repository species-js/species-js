/**
 * @module @species-js/function-introspection
 *
 * The published surface — every export the package documents as part of its
 * contract, named one by one.
 *
 * Curation is the point. `src/index.js` re-exports each subdomain with a star
 * and so carries the package's `@internal` machinery too; it stays that way
 * because `#index` is what the test suite imports. This file is what
 * `package.json`'s `exports["."]` resolves to, so a consumer reaches only what
 * is listed below.
 *
 * The tag is not the boundary. `@internal` is documentation that no resolver
 * reads — this list is the enforcement, and `scripts/check-public-surface.mjs`
 * fails the build when the two disagree.
 *
 * Re-export order below is FREE, which is worth stating because the sibling
 * package's is not. type-detection carries a `function ↔ utility` eval-time
 * cycle that makes its barrel order load-bearing (ADR #083). This package has
 * no such cycle: `bound` and `concise` read `#utility`, `#utility` reads
 * `#config`, `arrow` reads nothing internal, and nothing reads back. The order
 * follows the dependency direction for readability alone.
 */

export { getCondensedFunctionSource } from '#utility';

export { doesIndicateBoundFunction, doesStronglyIndicateBoundFunction } from '#bound';

export { isArrowFunction, isAsyncArrowFunction, isAnyArrowFunction } from '#arrow';

export {
  isPlainConciseMethod,
  isConciseAsyncMethod,
  isConciseGeneratorMethod,
  isConciseAsyncGeneratorMethod,
  isAnyConciseMethod,
} from '#concise';
