// @ts-check

/**
 * @module browser.probes
 *
 * Cross-engine probes for the built UMD bundle, run by
 * `scripts/check-browser-contract.mjs` in Chromium, Firefox and WebKit.
 *
 * This package reads no function source, so it carries none of the engine
 * exposure `function-introspection` does. What it does carry is a shape check
 * over caller-supplied `exports`, resolved through type-detection's
 * `isPlainOrDictionaryObject` — and in a browser a caller can hand it two
 * things Node has no analogue for: a host object, and an object from another
 * browsing context.
 *
 * Three probes, one per question the Node suites cannot ask.
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
 * Whether calling `run` throws a `TypeError`, read structurally.
 *
 * `instanceof` is realm-relative and these probes deliberately cross realms,
 * so the brand and the name are the only realm-independent reading — the same
 * approach `smoke.probes.mjs` takes for the UMD's `vm` context.
 *
 * @param {() => unknown} run - the call expected to be refused
 * @returns {boolean} true when it threw a `TypeError`
 */
const refuses = (run) => {
  try {
    run();
    return false;
  } catch (reason) {
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
    name: 'A1 · the artifact is built the same way under a browser engine',
    run: (ns) => {
      const namespace = builderOf(ns)('demo', { a: 1 });

      return (
        Object.getPrototypeOf(namespace) === null &&
        Object.isFrozen(namespace) === true &&
        Object.prototype.toString.call(namespace) === '[object CustomNamespace]' &&
        String(namespace) === "[namespace 'demo']" &&
        namespace.a === 1
      );
    },
  },
  {
    name: 'A2 · a host object is refused as `exports`',
    run: (ns) => {
      const build = builderOf(ns);

      // An `Element` is an object with own properties and a prototype chain,
      // so nothing but the shape check separates it from a valid bag. Node has
      // no equivalent to hand the builder.
      return (
        refuses(() => build('demo', document.createElement('div'))) &&
        refuses(() => build('demo', /** @type {object} */ (window))) &&
        // the positive half, or a builder stubbed to always throw would pass
        build('demo', { a: 1 }).a === 1
      );
    },
  },
  {
    name: 'B1 · a plain object from another realm is accepted as `exports`',
    run: (ns) => {
      const frame = document.createElement('iframe');

      document.body.appendChild(frame);
      try {
        const realm = /** @type {Window & typeof globalThis} */ (
          /** @type {unknown} */ (frame.contentWindow)
        );
        const foreign = new realm.Object();

        /** @type {Record<string, unknown>} */ (foreign).a = 1;

        const namespace = builderOf(ns)('demo', foreign);

        return (
          // proof the realm is genuinely foreign, or this tests nothing
          foreign instanceof Object === false &&
          namespace.a === 1 &&
          Object.prototype.toString.call(namespace) === '[object CustomNamespace]'
        );
      } finally {
        frame.remove();
      }
    },
  },
];

// - the runner injects this file as a module `<script>` after the UMD bundle
//   and reads the array off the global; `export` is not reachable from
//   `page.evaluate`. See the note in function-introspection's twin.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
