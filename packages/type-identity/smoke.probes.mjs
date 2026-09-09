// @ts-check

/**
 * @module smoke.probes
 *
 * Behavioral probes for the built artifacts, run by
 * `scripts/check-bundle-smoke.mjs` against every bundle this package publishes.
 *
 * These are NOT a second test suite. The contract suite tests the source against
 * the spec; these ask a narrower question the suite structurally cannot: does
 * the code survive bundling?
 *
 * So each probe crosses the type-detection boundary, which is an external import
 * in the node and browser builds and INLINED in the UMD. The entries read
 * `isNewableFunction`, `hasOwnWritablePrototype`, `hasOwnNonWritablePrototype`,
 * `getFunctionSource`, `canOwnPropertyBeShaped`, `getDefinedConstructor`,
 * `isCallable`, `isObjectOrCallable`, `isString`, `isPlainObject`, `isError` and
 * `objectHasOwn` through that seam, and write with the `frozenEntryDescriptor`
 * and `sealedEntryAccessor` presets from it. A probe touching only this
 * package's own logic would pass on a bundle whose dependency had been dropped.
 *
 * They also prove the entry that ships is the CURATED one: the namespace a probe
 * receives is whatever `exports["."]` resolves to, so an `@internal` value
 * leaking back into the published surface changes what these see.
 *
 * Every claim with a negative case asserts both sides, so a stub that always
 * accepts or always refuses fails here rather than passing half.
 */

/**
 * @typedef {{ success: true, warning?: string }
 *   | { success: false, reason: { name?: unknown, message?: unknown, cause?: unknown } }
 * } Result
 */

/**
 * @typedef {{
 *   defineStableTypeIdentity: (ctor: unknown, name: unknown, ...tag: unknown[]) => Result,
 *   brandFunctionName: (fct: unknown, name: unknown) => Result,
 *   doesCarryStableTypeIdentity: (value?: unknown) => boolean,
 * }} Surface
 */

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/**
 * The published surface, retyped from the loosely-typed probe namespace.
 *
 * @param {Record<string, (...args: unknown[]) => unknown>} ns - the loaded bundle
 * @returns {Surface} the three entries under their real signatures
 */
const surfaceOf = (ns) => /** @type {Surface} */ (/** @type {unknown} */ (ns));

/**
 * Whether a result is a refusal carrying an error of the given class.
 *
 * `instanceof` is REALM-RELATIVE, and the UMD bundle is evaluated inside its own
 * `vm` context by the smoke harness. A reason crossing back from there is an
 * instance of that realm's `TypeError`, never this one's, so an `instanceof`
 * test reports false for a correct refusal. Read the brand and the name instead
 * — the structural approach type-detection itself takes, and realm-independent
 * by construction.
 *
 * @param {Result} result - the value a freezing entry returned
 * @param {string} className - the expected `name` of the reason
 * @returns {boolean} true when the attempt was refused with that error class
 */
const refusedWith = (result, className) => {
  if (result.success !== false) {
    return false;
  }
  const reason = result.reason;

  return (
    Object.prototype.toString.call(reason) === '[object Error]' &&
    reason.name === className
  );
};

/**
 * A fresh `class`-syntax constructor, carrying a member so it is a real class
 * rather than an empty one. Each probe needs its own: freezing is a one-way
 * door, so a shared candidate would make probe order load-bearing.
 *
 * @returns {new () => { identify: () => string }} an unfrozen class constructor
 */
const freshClass = () =>
  class Candidate {
    identify() {
      return 'candidate';
    }
  };

/** @type {Probe[]} */
export const probes = [
  {
    // `frozenEntryDescriptor` and `sealedEntryAccessor` are type-detection
    // presets; a dropped dependency leaves the flags wrong, not the slot empty.
    name: 'freezes all three slots with the presets from the type-detection seam',
    run: (ns) => {
      const { defineStableTypeIdentity } = surfaceOf(ns);
      const Target = freshClass();
      const result = defineStableTypeIdentity(Target, 'Foo');

      const tag = Object.getOwnPropertyDescriptor(Target.prototype, Symbol.toStringTag);
      const ctor = Object.getOwnPropertyDescriptor(Target.prototype, 'constructor');
      const name = Object.getOwnPropertyDescriptor(Target, 'name');

      return (
        result.success === true &&
        typeof tag?.get === 'function' &&
        tag.set === undefined &&
        tag.enumerable === false &&
        tag.configurable === false &&
        ctor?.value === Target &&
        ctor.writable === false &&
        ctor.configurable === false &&
        name?.value === 'Foo' &&
        name.writable === false &&
        name.configurable === false &&
        Object.prototype.toString.call(new Target()) === '[object Foo]'
      );
    },
  },
  {
    // `getDefinedConstructor` + `isNewableFunction` + `canOwnPropertyBeShaped`
    // all cross the seam here, and the negative side proves it reads the shape
    // rather than answering true for everything.
    name: 'reads the frozen identity back from either side, and refuses an unfrozen one',
    run: (ns) => {
      const { defineStableTypeIdentity, doesCarryStableTypeIdentity } = surfaceOf(ns);
      const Frozen = freshClass();
      defineStableTypeIdentity(Frozen, 'Frozen');
      const Plain = freshClass();

      return (
        doesCarryStableTypeIdentity(Frozen) === true &&
        doesCarryStableTypeIdentity(new Frozen()) === true &&
        doesCarryStableTypeIdentity(Plain) === false &&
        doesCarryStableTypeIdentity(new Plain()) === false &&
        doesCarryStableTypeIdentity(Promise) === false &&
        doesCarryStableTypeIdentity() === false
      );
    },
  },
  {
    // The shape gate: `hasOwnWritablePrototype` and `hasOwnNonWritablePrototype`
    // admit the two userland shapes, `getFunctionSource` turns a built-in away
    // on its native source. Both directions, or a stub passes.
    name: 'admits the two userland constructor shapes and refuses a built-in',
    run: (ns) => {
      const { defineStableTypeIdentity } = surfaceOf(ns);
      function Es3() {}

      return (
        defineStableTypeIdentity(freshClass(), 'AClass').success === true &&
        defineStableTypeIdentity(Es3, 'AnEs3').success === true &&
        refusedWith(defineStableTypeIdentity(Array, 'Array'), 'TypeError') &&
        refusedWith(
          defineStableTypeIdentity(freshClass().bind(null), 'Bound'),
          'TypeError',
        ) &&
        refusedWith(
          defineStableTypeIdentity(() => {}, 'Arrow'),
          'TypeError',
        )
      );
    },
  },
  {
    // `isString` at the seam, and the boxed form is the half a truthiness check
    // would get wrong. The two error classes prove the reason is chosen, not
    // constant.
    name: 'normalizes a boxed String identifier, and separates a bad type from a bad value',
    run: (ns) => {
      const { defineStableTypeIdentity } = surfaceOf(ns);
      const Boxed = freshClass();
      const boxedResult = defineStableTypeIdentity(Boxed, new String('  Trimmed  '));

      return (
        boxedResult.success === true &&
        Boxed.name === 'Trimmed' &&
        typeof Boxed.name === 'string' &&
        refusedWith(defineStableTypeIdentity(freshClass(), 42), 'TypeError') &&
        refusedWith(defineStableTypeIdentity(freshClass(), '   '), 'RangeError')
      );
    },
  },
  {
    // Arity, not value, decides whether a tag was supplied — and the warning
    // arm compares the identifiers after the seam has unwrapped them.
    name: 'reports a diverging tag, defaults an omitted one, and refuses an explicit undefined',
    run: (ns) => {
      const { defineStableTypeIdentity } = surfaceOf(ns);
      const Diverging = freshClass();
      const Defaulted = freshClass();
      const diverging = defineStableTypeIdentity(Diverging, 'Name', 'Tag');
      const defaulted = defineStableTypeIdentity(Defaulted, 'Same');

      return (
        diverging.success === true &&
        typeof diverging.warning === 'string' &&
        Object.prototype.toString.call(new Diverging()) === '[object Tag]' &&
        defaulted.success === true &&
        'warning' in defaulted === false &&
        Object.prototype.toString.call(new Defaulted()) === '[object Same]' &&
        refusedWith(
          defineStableTypeIdentity(freshClass(), 'Name', undefined),
          'TypeError',
        )
      );
    },
  },
  {
    // `isCallable` and `canOwnPropertyBeShaped` at the seam; the one-way door is
    // the negative control.
    name: 'brands a callable name once and refuses the second attempt',
    run: (ns) => {
      const { brandFunctionName, doesCarryStableTypeIdentity } = surfaceOf(ns);
      const target = function original() {};
      const first = brandFunctionName(target, 'branded');
      const second = brandFunctionName(target, 'again');
      const descriptor = Object.getOwnPropertyDescriptor(target, 'name');

      return (
        first.success === true &&
        'warning' in first === false &&
        target.name === 'branded' &&
        descriptor?.writable === false &&
        descriptor.configurable === false &&
        refusedWith(second, 'TypeError') &&
        refusedWith(brandFunctionName({}, 'nope'), 'TypeError') &&
        doesCarryStableTypeIdentity(target) === false
      );
    },
  },
  {
    // `isError` plus the error-cause seam: a non-error throw is wrapped, and the
    // thrown value survives as `cause`. The capability probe that selects the
    // constructor runs at module load, so this also proves the bundle evaluated.
    name: 'never throws, and wraps a non-error refusal reason as a cause',
    run: (ns) => {
      const { defineStableTypeIdentity } = surfaceOf(ns);
      const thrower = function Thrower() {};
      thrower.prototype = new Proxy(
        {},
        {
          defineProperty() {
            throw 'a thrown string';
          },
        },
      );
      const wrapped = defineStableTypeIdentity(thrower, 'Thrower');

      const passesThrough = function PassesThrough() {};
      passesThrough.prototype = new Proxy(
        {},
        {
          defineProperty() {
            throw new RangeError('refused outright');
          },
        },
      );
      const unchanged = defineStableTypeIdentity(passesThrough, 'PassesThrough');

      return (
        refusedWith(wrapped, 'Error') &&
        wrapped.success === false &&
        wrapped.reason.cause === 'a thrown string' &&
        refusedWith(unchanged, 'RangeError') &&
        unchanged.success === false &&
        unchanged.reason.message === 'refused outright'
      );
    },
  },
];
