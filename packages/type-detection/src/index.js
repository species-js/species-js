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
 * - `@species-js/type-detection/error` — `AnyError` and `AbortError`
 *   discrimination with the `Error.isError` polyfill.
 * - `@species-js/type-detection/object` — `AnyObject`, `PlainObject`,
 *   `DictionaryObject`, and `PlainOrDictionaryObject` discrimination.
 * - `@species-js/type-detection/evented` — `EventTarget` and
 *   `AbortSignal` structural lattices.
 * - `@species-js/type-detection/thenable` — `Thenable`, `PromiseLike`,
 *   and `Promise` structural lattices.
 *
 * The re-export order below is load-bearing in exactly one respect: `#function`
 * must be re-exported FIRST; the remaining seven may then be ordered freely (for
 * readability / aesthetics). At module-load `#function` captures
 * `AsyncFunctionConstructor` by calling `#utility`'s `getDefinedConstructor`
 * (which itself reads `#function`'s `isCallable`) — an eval-time
 * `function ↔ utility` cycle. Placing `#function` first forces that
 * interdependent cluster (`function` / `utility` / `primitive` / `object`) to
 * evaluate fully before any later line runs; entering the cluster through any
 * other member first fires the capture against a binding still in its temporal
 * dead zone. The vite transform (vitest and the browser build) enforces this;
 * native Node ESM happens to tolerate it, so the constraint is invisible to a
 * plain `node` import and real only for the shipped artifact. `test/index.test.js`
 * is the guard. Recorded in ADR #083.
 */

export * from '#function';
export * from '#config';
export * from '#utility';
export * from '#primitive';
export * from '#object';
export * from '#error';
export * from '#evented';
export * from '#thenable';
