/**
 * The realm's global object, captured once at module-load.
 *
 * `globalThis` (ES2020 — the package floor) is the single
 * standardized handle to the global object across Node,
 * browsers, workers, and UMD bundles, so a bare reference
 * resolves on every target the package ships to. Consumers
 * read members through this capture (`globalContext.DOMException`)
 * rather than as bare intrinsic references — some module
 * runners (vitest's among them) fail to resolve a bare
 * `DOMException` within a project-module's scope even
 * though `globalThis.DOMException` is present. Reading
 * through the capture sidesteps that, and fixes the
 * global's identity to this realm.
 * @internal
 */
export declare const globalContext: typeof globalThis;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

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
export declare const getOwnPropertyDescriptors: typeof Object.getOwnPropertyDescriptors;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
