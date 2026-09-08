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
const named = function namedFunction() {};

/** The condensed source of an anonymous native function. */
const NATIVE_ANONYMOUS = 'function(){[native code]}';

/**
 * A bound function whose target carries a name chosen by the caller.
 *
 * `name` is `configurable: true` on every function, so this is reachable by
 * anyone holding a reference — and on a name-rendering engine it is spliced
 * into the native source form, which is what made it an attack.
 *
 * @param {string} name - the name to install before binding
 * @returns {(...args: unknown[]) => unknown} the bound function
 */
const boundWithName = (name) => {
  const target = function () {};

  Object.defineProperty(target, 'name', { value: name, configurable: true });

  return target.bind(null);
};

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
    // The contract ADR #100 introduced, checked over the BUILT bundle: the
    // cascade reads no function source, so a proxy is judged by the name it
    // forwards and by nothing else. Bundling rewrites source text, which is
    // exactly the kind of change a source-reading predicate would notice and
    // this one must not.
    name: 'doesIndicateBoundFunction judges a Proxy by the name it forwards',
    run: (ns) =>
      ns.doesIndicateBoundFunction(new Proxy(arrow, {})) === false &&
      ns.doesIndicateBoundFunction(new Proxy(plain.bind(null), {})) === true &&
      ns.doesIndicateBoundFunction(Function.prototype) === false,
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
    //
    // The FIRST case is deliberately not an equality against the anonymous
    // form. The condensate normalizes LAYOUT, not the name slot, and a
    // name-rendering engine puts the bound target's name there — so the
    // portable claim is that the marker terminates the string, which is all
    // any engine guarantees (ECMA-262's NativeFunction grammar makes the
    // marker mandatory and the name optional).
    name: 'getCondensedFunctionSource normalizes layout, not the name slot',
    run: (ns) =>
      String(ns.getCondensedFunctionSource(plain.bind(null))).endsWith(
        '{[native code]}',
      ) && ns.getCondensedFunctionSource(arrow) === '(a)=> a',
  },
  {
    // The realm probe decides which reading `doesStronglyIndicateBoundFunction`
    // uses, so one that disagrees with its own engine selects the reading that
    // cannot fire — silently, for every caller.
    //
    // This is also the only assertion that can catch a BUILD-level break of
    // that probe. Its expectations are derived from a module-local function's
    // `name`, which the minifier renames; on V8 a broken probe and a working
    // one both answer `false`, so nothing here separates them. A runtime on
    // JavaScriptCore does — which is the whole reason this file is run under
    // more than one.
    name: 'the realm probe agrees with what this runtime renders',
    run: (ns) =>
      ns.hasJavaScriptCoreBindBehavior() ===
      (ns.getCondensedFunctionSource(named.bind(null)) !== NATIVE_ANONYMOUS),
  },
  {
    // The recall contract, over the built bundle. Whichever reading this
    // runtime selects, every genuinely bound form must survive it.
    name: 'every genuinely bound form is strongly indicated, on any runtime',
    run: (ns) =>
      [plain, named, arrow, method, generatorMethod].every(
        (target) => ns.doesStronglyIndicateBoundFunction(target.bind(null)) === true,
      ) &&
      ns.doesStronglyIndicateBoundFunction(plain) === false &&
      ns.doesStronglyIndicateBoundFunction(Function.prototype) === false,
  },
  {
    // CONCISE's law L3, over the built bundle: every failure of that module is
    // a MISS, never a false positive. The name below is the one that broke it
    // on JavaScriptCore — it closes the parameter list and body and then opens
    // a fresh identifier, so on an engine that renders the target's name the
    // spliced source reads as a method named `function`.
    //
    // Unreachable on V8, where the string never forms. It is here so that a
    // runtime which CAN form it asserts the law rather than assuming it.
    name: 'an adversarial name cannot buy a concise-method admission',
    run: (ns) =>
      ['(){} evil', 'foo(){}', '[native code]', ''].every(
        (name) =>
          ns.isPlainConciseMethod(boundWithName(name)) === false &&
          ns.isAnyConciseMethod(boundWithName(name)) === false,
      ) &&
      // the positive control — without it a pair stubbed to `false` passes
      ns.isPlainConciseMethod(method) === true,
  },
];
