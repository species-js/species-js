// @ts-check

/**
 * @module #config
 *
 * Realm-fixed captures this package's predicates read through.
 *
 * Internal only. Unlike type-detection's `config`, this module is not a
 * published subpath — the bundler inlines it into the entries that consume it.
 *
 * Capturing a member once at module-load, rather than reaching for `Object.x`
 * at each call site, fixes its identity to this realm and shields the
 * predicates from later tampering with the global `Object`.
 */

/**
 * The realm's global object, captured once at module-load.
 *
 * `globalThis` (ES2020 — the package floor) is the one standardized handle to
 * the global object across Node, browsers, workers and UMD bundles. A bare
 * reference therefore resolves on every target the package ships to.
 *
 * Members are read through this capture (`globalContext.DOMException`) rather
 * than as bare intrinsic references. Some module runners (vitest's among them)
 * fail to resolve a bare `DOMException` within a project module's scope even
 * though `globalThis.DOMException` is present. Reading through the capture
 * sidesteps that, and fixes the global's identity to this realm.
 *
 * @internal
 */
export const globalContext = globalThis;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

const o = globalContext.Object;

/**
 * `Object.getOwnPropertyDescriptors`, realm-fixed at module-load.
 *
 * Captured here rather than imported from `@species-js/type-detection`, whose
 * own capture is `@internal`. A capture of a platform native is idempotent —
 * both packages would hold the very same function object — so there is no
 * shared state to centralize and nothing that can drift. Only values carrying
 * IDENTITY (a sentinel compared by reference) or a real value-add (a retype, a
 * polyfill fallback) are worth a cross-package edge.
 *
 * @internal
 */
export const getOwnPropertyDescriptors = o.getOwnPropertyDescriptors;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
