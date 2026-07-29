/**
 * @module @species-js/type-detection/foundation
 *
 * The package's dependency floor — pure, import-free constants shared across
 * the detection modules. `foundation` imports nothing, so by ES-module
 * post-order evaluation it is fully initialized before any module that
 * imports it. That ordering guarantee is the module's reason to exist: a
 * hoisted helper can read a `foundation` constant at another module's load
 * time regardless of which subpath is entered first, without risking a
 * temporal-dead-zone crash from the `config ↔ function ↔ utility` import
 * cycle (ADR #070).
 * @internal
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * The trusted-data sentinel — the call-site hint threaded as the third
 * positional argument through the inert descriptor-walk and every inert
 * probe. When present it lets those helpers skip `isValidPropertyKey` on the
 * hot path, trading signature width for the skip (#058).
 *
 * A bare `true`; its literal type is the whole contract.
 * @internal
 */
export const TRUSTED_DATA_CONFIRMATION = true;
