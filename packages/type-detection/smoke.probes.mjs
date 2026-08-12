// @ts-check

/**
 * @module smoke.probes
 *
 * Behavioral probes for the built artifacts, run by `scripts/check-bundle-smoke.mjs`
 * against every bundle this package publishes.
 *
 * These are NOT a second test suite — the 3746 specs test the source. These ask
 * the narrower question no spec can: does the code still work after bundling?
 *
 * So the selection is deliberate rather than representative. One probe per
 * SUBDOMAIN, because each is a separate module and a separate build entry, and
 * a bundling fault takes out a module rather than a function. Preference goes
 * to the machinery most likely to break when minified or re-scoped: the
 * eval-time captures (`getDefinedConstructor` and the species constructors
 * behind the async/generator predicates), which depend on module evaluation
 * ORDER — the one thing ADR #083 records as load-bearing in this package.
 */

const plain = function () {};

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/** @type {Probe[]} */
export const probes = [
  {
    name: 'function — the callable floor holds both ways',
    run: (ns) => ns.isFunction(plain) === true && ns.isFunction({}) === false,
  },
  {
    name: 'function — the species predicates survive their eval-time captures',
    run: (ns) =>
      ns.isAsyncFunction(async () => {}) === true &&
      ns.isAsyncFunction(plain) === false &&
      ns.isGeneratorFunction(function* () {}) === true &&
      ns.isGeneratorFunction(plain) === false,
  },
  {
    name: 'utility — getDefinedConstructor resolves across the function/utility cycle',
    run: (ns) =>
      ns.getDefinedConstructor([]) === Array &&
      ns.getDefinedConstructorName([]) === 'Array',
  },
  {
    name: 'utility — getFunctionSource is throw-safe, not throwing',
    run: (ns) =>
      typeof ns.getFunctionSource(plain) === 'string' &&
      ns.getFunctionSource(Object.create(null)) === undefined,
  },
  {
    // `isString` admits the BOXED form too — a deliberate design here, not an
    // oversight, so the probe pins it rather than the intuitive opposite.
    name: 'primitive — typeof guards discriminate, boxed forms included',
    run: (ns) =>
      ns.isString('x') === true &&
      ns.isString(new String('x')) === true &&
      ns.isString(1) === false &&
      ns.isNumber(1) === true &&
      ns.isBoolean(false) === true,
  },
  {
    name: 'object — plain object discrimination',
    run: (ns) => ns.isPlainObject({}) === true && ns.isPlainObject([]) === false,
  },
  {
    name: 'thenable — promise and thenable are distinct questions',
    run: (ns) =>
      ns.isPromise(Promise.resolve()) === true &&
      ns.isPromise({ then() {} }) === false &&
      ns.isThenable({ then() {} }) === true,
  },
  {
    name: 'evented — EventTarget is recognized structurally',
    run: (ns) =>
      ns.isEventTarget(new EventTarget()) === true && ns.isEventTarget({}) === false,
  },
  {
    name: 'error — isError spans the error lattice, isGenericError narrows it',
    run: (ns) =>
      ns.isError(new TypeError('x')) === true &&
      ns.isError('x') === false &&
      ns.isGenericError(new Error('x')) === true,
  },
  {
    name: 'utility — getTaggedType reads the tag',
    run: (ns) => ns.getTaggedType([]) === 'Array' && ns.getTaggedType(null) === 'Null',
  },
];
