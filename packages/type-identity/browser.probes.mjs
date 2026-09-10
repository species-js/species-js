// @ts-check

/**
 * @module browser.probes
 *
 * Cross-engine probes for the built UMD bundle, run by
 * `scripts/check-browser-contract.mjs` in Chromium, Firefox and WebKit.
 *
 * This package exists for the case where `instanceof` fails because two
 * structurally identical constructors are not identical — and a browser is the
 * only place that case is real rather than simulated. The Node suites reach it
 * through `node:vm`, which is a genuine realm but not the one consumers meet.
 * An `iframe` is: a second browsing context, with its own intrinsics, its own
 * `Object.prototype.toString`, and its own copy of every constructor.
 *
 * So the probes ask the three questions no Node suite can:
 *
 * 1. do the three slots land the same way under an engine that is not V8;
 * 2. is a HOST constructor refused by the shape gate — a built-in the language
 *    does not define, which Node has no analogue for;
 * 3. does a frozen identity survive a REAL realm boundary in both directions —
 *    written here and read there, written there and read here.
 *
 * Each probe carries a positive control. An all-negative probe passes a stub
 * that answers `false` to everything while reading nothing.
 */

/**
 * @typedef {{ success: boolean, reason?: { name?: string, message?: string } }} Result
 */

/**
 * @typedef {{
 *   defineStableTypeIdentity: (constructor: unknown, name: string, ...tag: string[]) => Result,
 *   brandFunctionName: (fct: unknown, name: string) => Result,
 *   doesCarryStableTypeIdentity: (value?: unknown) => boolean,
 * }} Surface
 */

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/**
 * The published entries, retyped from the loosely-typed probe namespace.
 *
 * @param {Record<string, (...args: unknown[]) => unknown>} ns - the loaded bundle
 * @returns {Surface} the three entries under their real signatures
 */
const surfaceOf = (ns) => /** @type {Surface} */ (/** @type {unknown} */ (ns));

/**
 * A constructor nothing else has touched.
 *
 * Freezing is a one-way door, so a shared fixture would make probe ORDER
 * load-bearing — the second probe to reach it fails on an already-frozen
 * `name` for a reason that has nothing to do with what it asserts. The class
 * carries a member because an empty one is refused by the workspace's lint
 * rules, and because a prototype with something on it is the realistic shape.
 *
 * @returns {new () => object} a fresh class
 */
const freshClass = () =>
  class Candidate {
    identify() {
      return 'candidate';
    }
  };

/**
 * Builds an `iframe`, hands its window to `use`, and removes it afterward.
 *
 * The frame is a genuine second realm: `new realm.Object() instanceof Object`
 * is `false` from here, which each probe asserts before drawing any conclusion
 * from it. Without that check a same-realm regression would read as a pass.
 *
 * @template T
 * @param {(realm: Window & typeof globalThis) => T} use - the observation to make
 * @returns {T} whatever `use` answered
 */
const withForeignRealm = (use) => {
  const frame = document.createElement('iframe');

  document.body.appendChild(frame);
  try {
    return use(
      /** @type {Window & typeof globalThis} */ (
        /** @type {unknown} */ (frame.contentWindow)
      ),
    );
  } finally {
    frame.remove();
  }
};

/** @type {Probe[]} */
export const probes = [
  {
    name: 'A1 · the three slots land the same way under a browser engine',
    run: (ns) => {
      const { defineStableTypeIdentity, doesCarryStableTypeIdentity } = surfaceOf(ns);
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
        Object.prototype.toString.call(new Target()) === '[object Foo]' &&
        doesCarryStableTypeIdentity(Target) === true &&
        // the negative half, or a stub answering true to everything passes
        doesCarryStableTypeIdentity(freshClass()) === false
      );
    },
  },
  {
    name: 'A2 · a HOST constructor is refused by the shape gate',
    run: (ns) => {
      const { defineStableTypeIdentity, brandFunctionName } = surfaceOf(ns);

      // `HTMLDivElement` is newable and has an own `prototype`, so nothing but
      // the source read separates it from a userland class — and it is a
      // built-in the LANGUAGE never defined, which is the input Node cannot
      // supply. The freezing entry must refuse it exactly as it refuses `Array`.
      const host = defineStableTypeIdentity(HTMLDivElement, 'Div');
      const language = defineStableTypeIdentity(Array, 'Arr');

      // and the branding entry must still ADMIT a built-in, since it reads no
      // prototype and so has no shape test for one to fail (`brand/B1`). A
      // host method is the browser's version of that, and the change is
      // permanent — so this brands a function the page owns, not a shared one.
      const own = brandFunctionName(function local() {
        return undefined;
      }, 'branded');

      return (
        host.success === false &&
        host.reason?.name === 'TypeError' &&
        language.success === false &&
        own.success === true &&
        // the positive control: a userland class in this same engine is taken
        defineStableTypeIdentity(freshClass(), 'Foo').success === true
      );
    },
  },
  {
    name: 'B1 · a constructor from another BROWSING CONTEXT freezes, and both realms agree',
    run: (ns) => {
      const { defineStableTypeIdentity, doesCarryStableTypeIdentity } = surfaceOf(ns);

      return withForeignRealm((realm) => {
        const Foreign = /** @type {new () => object} */ (
          /** @type {unknown} */ (
            realm.eval('(class Foreign { identify() { return "foreign"; } })')
          )
        );

        // proof the realm is genuinely foreign, or this probe tests nothing
        if (Foreign instanceof Object === true) {
          return false;
        }

        const result = defineStableTypeIdentity(Foreign, 'Held');
        const instance = new Foreign();

        return (
          result.success === true &&
          doesCarryStableTypeIdentity(Foreign) === true &&
          doesCarryStableTypeIdentity(instance) === true &&
          // read from HERE
          Object.prototype.toString.call(instance) === '[object Held]' &&
          // and read from THERE, through that realm's own intrinsic — the whole
          // claim of the package in one expression
          realm.Object.prototype.toString.call(instance) === '[object Held]' &&
          /** @type {{ name: string }} */ (/** @type {unknown} */ (Foreign)).name ===
            'Held'
        );
      });
    },
  },
  {
    name: 'B2 · a frozen identity is read back ACROSS the boundary, from either side',
    run: (ns) => {
      const { defineStableTypeIdentity, doesCarryStableTypeIdentity } = surfaceOf(ns);

      return withForeignRealm((realm) => {
        // frozen HERE, inspected from a value built THERE: the foreign realm
        // constructs from our frozen prototype, and the verdict must travel
        const Local = freshClass();

        if (defineStableTypeIdentity(Local, 'Local').success !== true) {
          return false;
        }

        const built = /** @type {(ctor: unknown) => object} */ (
          /** @type {unknown} */ (realm.eval('(Ctor) => new Ctor()'))
        )(Local);

        return (
          built instanceof Object === true &&
          doesCarryStableTypeIdentity(built) === true &&
          Object.prototype.toString.call(built) === '[object Local]' &&
          realm.Object.prototype.toString.call(built) === '[object Local]' &&
          // the negative half from the same realm, so the verdict is read and
          // not assumed
          doesCarryStableTypeIdentity(
            /** @type {(ctor: unknown) => object} */ (
              /** @type {unknown} */ (realm.eval('(Ctor) => new Ctor()'))
            )(freshClass()),
          ) === false
        );
      });
    },
  },
];

// - the runner injects this file as a module `<script>` after the UMD bundle
//   and reads the array off the global; `export` is not reachable from
//   `page.evaluate`. See the note in custom-namespace's twin.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
