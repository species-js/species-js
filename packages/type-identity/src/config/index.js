// @ts-check

/**
 * @module #config
 *
 * Realm-fixed captures this package's entries read through.
 *
 * Internal only. Unlike type-detection's `config`, this module is not a
 * published subpath — the bundler inlines it into the entry that consumes it.
 *
 * Capturing a member once at module-load, rather than reaching for `Object.x`
 * at each call site, fixes its identity to this realm and shields the sealing
 * entries from later tampering with the global `Object`.
 *
 * ADR #086 is why these live here rather than being imported from
 * `@species-js/type-detection`: a raw capture of a platform native stays
 * `@internal` in the package that holds it, and every package captures its
 * own. Do not "tidy" them into a cross-package import.
 *
 * The rule's other half runs the opposite way: a value-add — a retype, a
 * curated preset, a polyfill fallback such as `objectHasOwn` — is imported
 * from the type-detection root rather than reproduced here.
 */

/**
 * The realm's global object, captured once at module-load.
 *
 * `globalThis` (ES2020 — the package floor) is the one standardized handle to
 * the global object across Node, browsers, workers and UMD bundles. A bare
 * reference therefore resolves on every target the package ships to.
 *
 * Members are read through this capture (`globalContext.Symbol.toStringTag`)
 * rather than as bare intrinsic references. Some module runners (vitest's
 * among them) fail to resolve a bare intrinsic within a project module's scope
 * even though the `globalThis` member is present. Reading through the capture
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
 * `Object.getPrototypeOf`, realm-fixed at module-load.
 *
 * Reads the prototype a sealing candidate's `constructor` back-reference is
 * verified against.
 *
 * The `.d.ts` retypes the lib's `(o: any) => any` to
 * `(o: unknown) => object | Callable | null`, matching type-detection's own
 * capture and closing the `any`-return cascade at consumer call sites. The
 * runtime export is the unwrapped native method.
 *
 * @internal
 */
export const getPrototypeOf = o.getPrototypeOf;

/**
 * `Object.defineProperty`, realm-fixed at module-load.
 *
 * The one write the sealing entries make. Held here so a post-load
 * reassignment of the global `Object` cannot redirect the seal.
 *
 * @internal
 */
export const defineProperty = o.defineProperty;

/**
 * `Object.getOwnPropertyDescriptor`, realm-fixed at module-load.
 *
 * The inert read behind every criterion check — a descriptor is inspected
 * rather than the property value, so a getter is never invoked.
 *
 * @internal
 */
export const getOwnPropertyDescriptor = o.getOwnPropertyDescriptor;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
