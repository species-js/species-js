/**
 * @module #config
 *
 * Realm-fixed captures this package's namespace builder reads through.
 *
 * Internal only. Unlike type-detection's `config`, this module is not a
 * published subpath — the bundler inlines it into the entry that consumes it.
 *
 * Capturing a member once at module-load, rather than reaching for `Object.x`
 * at each call site, fixes its identity to this realm and shields the builder
 * from later tampering with the global `Object`.
 *
 * ADR #086 is why these live here rather than being imported from
 * `@species-js/type-detection`: a raw capture of a platform native stays
 * `@internal` in the package that holds it, and every package captures its
 * own. Do not "tidy" them into a cross-package import.
 *
 * The rule's other half runs the opposite way: a value-add — a retype such as
 * `objectCreate`, a curated preset such as `frozenDataDescriptor` — is
 * imported from the type-detection root rather than reproduced here.
 */

/**
 * The realm's global object, captured once at module-load.
 *
 * `globalThis` (ES2020 — the package floor) is the one standardized handle to
 * the global object across Node, browsers, workers and UMD bundles. A bare
 * reference therefore resolves on every target the package ships to.
 *
 * Members are read through this capture (`globalContext.String`) rather than
 * as bare intrinsic references. Some module runners (vitest's among them) fail
 * to resolve a bare intrinsic within a project module's scope even though the
 * `globalThis` member is present. Reading through the capture sidesteps that,
 * and fixes the global's identity to this realm.
 *
 * @internal
 */
export declare const globalContext: typeof globalThis;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Object Static Methods
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * `Object.assign`, realm-fixed at module-load.
 *
 * Pairs with the root's `objectCreate` to build the prototype-less lookup
 * table in `toPrimitive` — the house `Object.assign(Object.create(null), {…})`
 * form. Captured rather than imported because it is a raw native; the retype
 * `objectCreate` carries is what keeps that one on the other side of the line.
 *
 * @internal
 */
export declare const objectAssign: typeof Object.assign;

/**
 * `Object.freeze`, realm-fixed at module-load.
 *
 * The builder's last act. Every member is already non-writable and
 * non-configurable, so locking extensibility is all that remains — but
 * `freeze` rather than `preventExtensions` deliberately, so the guarantee does
 * not rest on the member flags staying right. Loosen the recomposition and the
 * object stays frozen anyway.
 *
 * @internal
 */
export declare const objectFreeze: typeof Object.freeze;

/**
 * `Object.defineProperty`, realm-fixed at module-load.
 *
 * The only write the builder makes — once per copied export, then once each for
 * the two well-known symbols, all before the freeze. Held here so a post-load
 * reassignment of the global `Object` cannot redirect what lands on the
 * namespace.
 *
 * @internal
 */
export declare const defineProperty: typeof Object.defineProperty;

/**
 * `Object.getOwnPropertyDescriptor`, realm-fixed at module-load.
 *
 * Reads a source member's descriptor so it can be recomposed non-writable and
 * non-configurable on the namespace. A descriptor read rather than a property
 * read, so a getter on the source is carried across rather than invoked.
 *
 * The raw form, not a throw-safe wrapper: a hostile `Proxy` trap surfaces to
 * the caller instead of yielding a namespace that is quietly missing a member.
 *
 * @internal
 */
export declare const getOwnPropertyDescriptor: typeof Object.getOwnPropertyDescriptor;

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
