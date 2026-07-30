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
 * - `@species-js/type-detection/error` — `AnyError` and `AbortError`
 *   discrimination with the `Error.isError` polyfill.
 * - `@species-js/type-detection/object` — `AnyObject`, `PlainObject`,
 *   `DictionaryObject`, and `PlainOrDictionaryObject` discrimination.
 * - `@species-js/type-detection/evented` — `EventTarget` and
 *   `AbortSignal` structural lattices.
 * - `@species-js/type-detection/thenable` — `Thenable`, `PromiseLike`,
 *   and `Promise` structural lattices.
 *
 * The re-export order below mirrors the `.js` barrel and is load-bearing in one
 * respect: `#function` must be re-exported FIRST; the remaining seven may then be
 * ordered freely. At load it captures `AsyncFunctionConstructor` via `#utility`'s
 * `getDefinedConstructor`, closing an eval-time `function ↔ utility` cycle;
 * `#function`-first forces that cluster to resolve, and any other order leaves a
 * binding in a temporal dead zone under the vite transform (native Node tolerates
 * it). `test/index.test.js` guards it; see ADR #083.
 */

export * from '#function';
export * from '#config';
export * from '#utility';
export * from '#primitive';
export * from '#object';
export * from '#error';
export * from '#evented';
export * from '#thenable';
