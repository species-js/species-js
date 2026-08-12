// @ts-check

/**
 * @module smoke.probes
 *
 * Behavioral probes for the built artifacts, run by `scripts/check-bundle-smoke.mjs`
 * against every bundle this package publishes.
 *
 * These are NOT a second test suite. The 1674 specs test the source; these ask
 * a narrower question the specs structurally cannot: does the code survive
 * bundling? So each probe crosses the seam that bundling could break — the
 * type-detection boundary, which is an external import in the module builds
 * and inlined in the UMD. A probe that only touched this package's own code
 * would pass on a bundle whose dependency was dropped.
 *
 * One probe per public predicate, each with a positive and a negative case, so
 * a predicate stubbed to a constant fails here rather than passing half.
 */

// Typed from ABOVE, never inline. These fixtures are read through
// `Function.prototype.toString`, so an inline annotation would change the very
// source text the predicates parse — and the condensed-source probe below
// asserts `(a)=> a` character for character.
/** @type {(a: unknown) => unknown} */
const arrow = (a) => a;
/** @type {(a: unknown) => Promise<unknown>} */
const asyncArrow = async (a) => a;
const plain = function () {};
const method = { m() {} }.m;
const asyncMethod = { async m() {} }.m;
const generatorMethod = { *m() {} }.m;
const asyncGeneratorMethod = { async *m() {} }.m;

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/** @type {Probe[]} */
export const probes = [
  {
    name: 'isArrowFunction discriminates arrow from method',
    run: (ns) =>
      ns.isArrowFunction(arrow) === true && ns.isArrowFunction(method) === false,
  },
  {
    name: 'isAsyncArrowFunction resolves the async( collision',
    run: (ns) =>
      ns.isAsyncArrowFunction(asyncArrow) === true &&
      ns.isAsyncArrowFunction({ async() {} }.async) === false,
  },
  {
    name: 'isAnyArrowFunction is the union of both flavors',
    run: (ns) =>
      ns.isAnyArrowFunction(arrow) === true &&
      ns.isAnyArrowFunction(asyncArrow) === true &&
      ns.isAnyArrowFunction(plain) === false,
  },
  {
    name: 'isPlainConciseMethod admits a method and refuses an arrow',
    run: (ns) =>
      ns.isPlainConciseMethod(method) === true &&
      ns.isPlainConciseMethod(arrow) === false,
  },
  {
    name: 'isConciseAsyncMethod admits only the async flavor',
    run: (ns) =>
      ns.isConciseAsyncMethod(asyncMethod) === true &&
      ns.isConciseAsyncMethod(method) === false,
  },
  {
    name: 'isConciseGeneratorMethod admits only the generator flavor',
    run: (ns) =>
      ns.isConciseGeneratorMethod(generatorMethod) === true &&
      ns.isConciseGeneratorMethod(method) === false,
  },
  {
    name: 'isConciseAsyncGeneratorMethod admits only the async generator flavor',
    run: (ns) =>
      ns.isConciseAsyncGeneratorMethod(asyncGeneratorMethod) === true &&
      ns.isConciseAsyncGeneratorMethod(generatorMethod) === false,
  },
  {
    name: 'isAnyConciseMethod covers all four flavors and refuses an arrow',
    run: (ns) =>
      [method, asyncMethod, generatorMethod, asyncGeneratorMethod].every(
        (fn) => ns.isAnyConciseMethod(fn) === true,
      ) && ns.isAnyConciseMethod(arrow) === false,
  },
  {
    name: 'doesIndicateBoundFunction reads a bound function',
    run: (ns) =>
      ns.doesIndicateBoundFunction(plain.bind(null)) === true &&
      ns.doesIndicateBoundFunction(plain) === false,
  },
  {
    name: 'doesStronglyIndicateBoundFunction requires all three marks',
    run: (ns) =>
      ns.doesStronglyIndicateBoundFunction(plain.bind(null)) === true &&
      ns.doesStronglyIndicateBoundFunction(plain) === false,
  },
  {
    // The second case is the whole subtlety: whitespace adjacent to brackets
    // goes, every other run stays — so `(a) => a` condenses to `(a)=> a`, with
    // the space after the arrow intact.
    name: 'getCondensedFunctionSource normalizes the native form and only that',
    run: (ns) =>
      ns.getCondensedFunctionSource(plain.bind(null)) === 'function(){[native code]}' &&
      ns.getCondensedFunctionSource(arrow) === '(a)=> a',
  },
];
