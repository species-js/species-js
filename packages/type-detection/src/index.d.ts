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
 * Re-export order below mirrors the `.js` barrel, where the order is
 * driven by ESM module-load semantics (`@/function` first so the
 * `config ↔ function` cycle resolves through `function`'s hoisted
 * `isCallable` declaration).
 */

export * from '@/function';
export * from '@/config';
export * from '@/utility';
export * from '@/primitive';
export * from '@/error';
export * from '@/object';
export * from '@/evented';
export * from '@/thenable';
