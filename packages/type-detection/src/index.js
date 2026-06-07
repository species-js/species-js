// @ts-check

/**
 * @module @species-js/type-detection
 *
 * Runtime type detection with cross-realm safety for JavaScript values.
 *
 * Aggregates the package's per-domain subpaths into a single import
 * surface. Consumers may import either from the root
 * (`@species-js/type-detection`) or from a specific subdomain — the
 * latter when a single subdomain is wanted without depending on the
 * rest. Subpaths (`package.json` `exports` lists them foundation-first
 * for documentation lookup):
 *
 * - `@species-js/type-detection/config` — realm-fixed `Object` and
 *   prototype captures plus descriptor presets; mostly `@internal`.
 * - `@species-js/type-detection/utility` — cached prototype references,
 *   type-signature readers, constructor inspection, type resolution.
 * - `@species-js/type-detection/function` — the callable lattice
 *   (`Callable` floor through `AsyncFunction` / `GeneratorFunction` /
 *   `AsyncGeneratorFunction` species).
 * - `@species-js/type-detection/primitive` — `typeof` guards for the
 *   five JavaScript primitive types.
 * - `@species-js/type-detection/error` — `GenericError` and `AbortError`
 *   discrimination with the `Error.isError` polyfill.
 * - `@species-js/type-detection/object` — `AnyObject`, `PlainObject`,
 *   and `DictionaryObject` discrimination.
 * - `@species-js/type-detection/evented` — `EventTarget` and
 *   `AbortSignal` structural lattices.
 * - `@species-js/type-detection/thenable` — `Thenable`, `PromiseLike`,
 *   and `Promise` structural lattices.
 *
 * Re-export order below is driven by ESM module-load semantics rather
 * than documentation framing: `@/function` is re-exported first so that
 * its hoisted `export function isCallable` declaration is reachable
 * when `@/config` then evaluates and needs it for the
 * `isCallable(nativeHasOwn)` gate. With this order the
 * `config ↔ function` cycle resolves cleanly; reversing it would leave
 * `config`'s `const` exports in TDZ when `function`'s top-level
 * intrinsic captures fire mid-cycle.
 */

export * from '@/function';
export * from '@/config';
export * from '@/utility';
export * from '@/primitive';
export * from '@/error';
export * from '@/object';
export * from '@/evented';
export * from '@/thenable';
