// @ts-check

/**
 * @module smoke.probes
 *
 * Behavioral probes for the built artifacts, run by
 * `scripts/check-bundle-smoke.mjs` against every bundle this package publishes.
 *
 * These are NOT a second test suite. The contract suite tests the source
 * against the frozen spec; these ask a narrower question the suite
 * structurally cannot: does the code survive bundling?
 *
 * So each probe crosses the type-detection boundary, which is an external
 * import in the node and browser builds and INLINED in the UMD. The builder
 * reads `isString`, `isPlainOrDictionaryObject`, `isCallable`, `objectHasOwn`
 * and `getOwnPropertyKeys` through that seam, and writes members with the
 * `frozenDataDescriptor` / `frozenEntryDescriptor` presets and `objectCreate`
 * from it. A probe touching only this package's own logic would pass on a
 * bundle whose dependency had been dropped.
 *
 * The package exports one function, so the probes are organized by the seam
 * each one crosses rather than one-per-export. Where a claim has a negative
 * case it is asserted too, so a stub that always accepts or always throws
 * fails here rather than passing half.
 */

/**
 * @typedef {(name: string, exports: object) => Record<PropertyKey, unknown>} Build
 */

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/**
 * The builder, retyped from the loosely-typed probe namespace.
 *
 * @param {Record<string, (...args: unknown[]) => unknown>} ns - the loaded bundle
 * @returns {Build} the entry under its real signature
 */
const builderOf = (ns) =>
  /** @type {Build} */ (/** @type {unknown} */ (ns.createCustomNamespace));

/**
 * Whether calling `run` throws a `TypeError`.
 *
 * Rejections cross the seam through `isString` and
 * `isPlainOrDictionaryObject`, so a bundle that lost type-detection would
 * either stop rejecting or throw the wrong error.
 *
 * @param {() => unknown} run - the call expected to be refused
 * @returns {boolean} true when it threw a `TypeError`
 */
const refuses = (run) => {
  try {
    run();
    return false;
  } catch (reason) {
    // - `instanceof` is REALM-RELATIVE, and the UMD bundle is evaluated inside
    //   its own `vm` context by the smoke harness. An error crossing back from
    //   there is an instance of that realm's `TypeError`, never this one's, so
    //   an `instanceof` test reports false for a correct rejection. Read the
    //   brand and the name instead — the structural approach type-detection
    //   itself takes, and realm-independent by construction.
    const error = /** @type {{ name?: unknown }} */ (reason);

    return (
      Object.prototype.toString.call(reason) === '[object Error]' &&
      error.name === 'TypeError'
    );
  }
};

/** @type {Probe[]} */
export const probes = [
  {
    // `objectCreate` and the tag both come through the seam.
    name: 'builds a prototype-less, frozen namespace branded CustomNamespace',
    run: (ns) => {
      const namespace = builderOf(ns)('demo', { a: 1 });

      return (
        Object.getPrototypeOf(namespace) === null &&
        Object.isFrozen(namespace) === true &&
        Object.prototype.toString.call(namespace) === '[object CustomNamespace]' &&
        namespace.a === 1
      );
    },
  },
  {
    // The two descriptor presets are type-detection exports; a dropped
    // dependency would leave the flags wrong rather than the member missing.
    name: 'members carry the frozen presets, keeping only the source enumerable flag',
    run: (ns) => {
      const source = Object.defineProperty({ shown: 1 }, 'hidden', {
        value: 2,
        enumerable: false,
        configurable: true,
      });
      const namespace = builderOf(ns)('demo', source);
      const visible = Object.getOwnPropertyDescriptor(namespace, 'shown');
      const hidden = Object.getOwnPropertyDescriptor(namespace, 'hidden');

      return (
        visible?.enumerable === true &&
        visible.writable === false &&
        visible.configurable === false &&
        hidden?.enumerable === false &&
        hidden.value === 2
      );
    },
  },
  {
    // `isCallable` + `objectHasOwn` decide data-versus-accessor at the seam.
    name: 'an accessor member is resolved once and snapshotted, not copied',
    run: (ns) => {
      let calls = 0;
      let backing = 'first';
      const source = {
        get live() {
          calls += 1;
          return backing;
        },
      };
      const namespace = builderOf(ns)('demo', source);

      backing = 'second';

      return calls === 1 && namespace.live === 'first';
    },
  },
  {
    // `getOwnPropertyKeys` must return symbols as well as strings.
    name: 'a symbol-keyed member is included on the same terms',
    run: (ns) => {
      const key = Symbol('member');
      const namespace = builderOf(ns)('demo', { [key]: 'v' });

      return (
        namespace[key] === 'v' && Object.getOwnPropertySymbols(namespace).includes(key)
      );
    },
  },
  {
    name: 'one primitive form across all three engine hints',
    run: (ns) => {
      const namespace = builderOf(ns)('demo', { a: 1 });
      const toPrimitive = /** @type {(hint: string) => string | undefined} */ (
        namespace[Symbol.toPrimitive]
      );

      return (
        String(namespace) === "[namespace 'demo']" &&
        ['string', 'number', 'default'].every(
          (hint) => toPrimitive(hint) === "[namespace 'demo']",
        ) &&
        toPrimitive('nope') === undefined
      );
    },
  },
  {
    name: 'the brand does not travel on a copy',
    run: (ns) => {
      const namespace = builderOf(ns)('demo', { a: 1 });
      const copy = { ...namespace };

      return (
        Object.prototype.toString.call(copy) === '[object Object]' &&
        Object.getOwnPropertySymbols(copy).length === 0 &&
        copy.a === 1
      );
    },
  },
  {
    // `isString` at the seam — and the positive case proves it is a type
    // check, not a truthiness check.
    name: 'a non-string name is refused, a whitespace-only one accepted',
    run: (ns) => {
      const build = builderOf(ns);

      return (
        refuses(() =>
          build(/** @type {string} */ (/** @type {unknown} */ (42)), { a: 1 }),
        ) && String(build('   ', { a: 1 })) === "[namespace '']"
      );
    },
  },
  {
    // `isPlainOrDictionaryObject` at the seam, both directions.
    name: 'a non-object exports is refused, a prototype-less dictionary accepted',
    run: (ns) => {
      const build = builderOf(ns);
      const dictionary = Object.assign(Object.create(null), { a: 1 });

      return (
        refuses(() => build('demo', /** @type {object} */ ([]))) &&
        refuses(() => build('demo', {})) &&
        build('demo', dictionary).a === 1
      );
    },
  },
  {
    // The package's own loud-failure path: a member with no readable value
    // fails the build rather than being quietly left off.
    name: 'a member with no readable value fails the build',
    run: (ns) => {
      const build = builderOf(ns);
      const sink = { last: /** @type {unknown} */ (undefined) };
      const source = Object.defineProperty({}, 'writeOnly', {
        set(value) {
          sink.last = value;
        },
        enumerable: true,
        configurable: true,
      });

      return refuses(() => build('demo', source)) && build('demo', { a: 1 }).a === 1;
    },
  },
];
