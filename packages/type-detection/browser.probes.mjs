// @ts-check

/**
 * @module browser.probes
 *
 * Cross-engine probes for the built UMD bundle, run by
 * `scripts/check-browser-contract.mjs` in Chromium, Firefox and WebKit.
 *
 * Where `function-introspection`'s browser probes chase an engine difference,
 * these chase an INPUT difference. Every predicate here is published, and every
 * one of them is currently exercised against a Node stand-in for the thing a
 * consumer will actually pass it:
 *
 * - `isDOMException` is tested against Node's synthetic `DOMException`, never
 *   against one thrown by a real DOM operation.
 * - `isPlainObject` / `isDictionaryObject` have never seen an `Element`, a
 *   `Window` or a `Document` — host objects with no Node analogue at all.
 * - The cross-realm arms are proven through Node's `vm`, which shares an
 *   intrinsic graph in ways a genuine browsing context does not. An `<iframe>`
 *   is the realm boundary consumers actually have.
 *
 * A stand-in that behaves identically proves the claim; one that does not is
 * exactly what this file exists to surface.
 *
 * B6–B9 chase an engine difference after all: the class signature reads a
 * function's SOURCE, and only V8's rendering ever reaches the Node suites.
 * JavaScriptCore and SpiderMonkey lay a native source out on three lines, and
 * JavaScriptCore names a `Proxy` `ProxyObject`. Each asserts the portable
 * contract — the runner's layer B — so a red there is a defect, not a difference.
 *
 * Layer A is host objects; layer B the iframe realm and engine-rendered sources.
 */

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/**
 * Runs `use` against a fresh same-origin realm, then tears it down.
 *
 * An `about:blank` `<iframe>` attached to the document is the only realm
 * boundary a page can raise without a network round trip, and its
 * `contentWindow` carries a complete, genuinely separate intrinsic graph —
 * which is the property under test. The frame is removed even when `use`
 * throws, so one failing probe cannot leak a realm into the next.
 *
 * @param {(realm: Window & typeof globalThis) => boolean} use - the assertion
 * @returns {boolean} whatever `use` answered
 */
const withRealm = (use) => {
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

/**
 * The error a real DOM operation raises, rather than one constructed by hand.
 *
 * `querySelector` with a malformed selector is the cheapest DOM call that is
 * specified to throw a `DOMException`, needs no markup, and mutates nothing.
 *
 * @returns {unknown} the thrown value
 */
const domThrown = () => {
  try {
    document.querySelector(':::');
    return undefined;
  } catch (reason) {
    return reason;
  }
};

/** @type {Probe[]} */
export const probes = [
  // ----- Layer A — host objects, which have no Node analogue -----
  {
    name: 'A1 · an Element is an object but neither plain nor a dictionary',
    run: (ns) => {
      const element = document.createElement('div');

      return (
        ns.isObject(element) === true &&
        ns.isPlainObject(element) === false &&
        ns.isDictionaryObject(element) === false &&
        // the negative half — a stub answering one constant fails here
        ns.isPlainObject({}) === true
      );
    },
  },
  {
    name: 'A2 · Window and Document are objects, and neither is plain',
    run: (ns) => {
      return (
        ns.isObject(window) === true &&
        ns.isObject(document) === true &&
        ns.isPlainObject(window) === false &&
        ns.isPlainObject(document) === false &&
        ns.isObjectOrCallable(document) === true
      );
    },
  },
  {
    name: 'A3 · a DOMException raised by a real DOM call is an error, not generic',
    run: (ns) => {
      const thrown = domThrown();

      return (
        thrown !== undefined &&
        ns.isDOMException(thrown) === true &&
        ns.isError(thrown) === true &&
        ns.isGenericError(thrown) === false &&
        // and the inverse for an ordinary Error, so neither answer is a constant
        ns.isDOMException(new Error('x')) === false &&
        ns.isGenericError(new Error('x')) === true
      );
    },
  },
  {
    name: 'A4 · a legacy-code DOMException is recognized on the same terms',
    run: (ns) => {
      const legacy = new DOMException('boom', 'IndexSizeError');

      return (
        ns.isDOMException(legacy) === true &&
        ns.isError(legacy) === true &&
        // the legacy constant table is a browser artifact; its presence is what
        // makes this value distinguishable from a hand-rolled look-alike
        DOMException.INDEX_SIZE_ERR === 1 &&
        legacy.code === 1
      );
    },
  },
  {
    name: 'A5 · the browser AbortSignal answers the evented arms as specified',
    run: (ns) => {
      const controller = new AbortController();

      controller.abort();

      return (
        ns.isAbortError(controller.signal.reason) === true &&
        ns.isAbortSignal(controller.signal) === true &&
        ns.isAbortSignalLike(controller.signal) === true &&
        // `isEventTarget` admits an EventTarget INSTANCE, not a subclass — the
        // strict/like split, asserted here because a host EventTarget is a
        // different object graph from Node's
        ns.isEventTarget(new EventTarget()) === true &&
        ns.isEventTarget(controller.signal) === false &&
        ns.isEventTargetLike(controller.signal) === true
      );
    },
  },

  // ----- Layer B — a genuine browsing-context realm, not Node's `vm` -----
  {
    name: 'B1 · a plain object from another realm is still plain',
    run: (ns) =>
      withRealm((realm) => {
        const foreign = new realm.Object();
        const foreignDictionary = realm.Object.create(null);

        return (
          ns.isPlainObject(foreign) === true &&
          ns.isDictionaryObject(foreignDictionary) === true &&
          ns.isPlainObject(foreignDictionary) === false &&
          // proof the realm really is foreign, or the probe is testing nothing
          foreign instanceof Object === false
        );
      }),
  },
  {
    name: 'B2 · an Error from another realm is an error, and generic',
    run: (ns) =>
      withRealm((realm) => {
        const foreign = new realm.Error('x');

        return (
          ns.isError(foreign) === true &&
          ns.isGenericError(foreign) === true &&
          ns.isDOMException(foreign) === false &&
          foreign instanceof Error === false
        );
      }),
  },
  {
    name: 'B3 · a Promise from another realm is a promise',
    run: (ns) =>
      withRealm((realm) => {
        const foreign = realm.Promise.resolve(1);

        return (
          ns.isPromise(foreign) === true &&
          ns.isThenable(foreign) === true &&
          ns.isPromise({ then() {} }) === false
        );
      }),
  },
  {
    name: 'B4 · an Array from another realm is an object but not plain',
    run: (ns) =>
      withRealm((realm) => {
        const foreign = new realm.Array(3);

        return (
          ns.isObject(foreign) === true &&
          ns.isPlainObject(foreign) === false &&
          Array.isArray(foreign) === true
        );
      }),
  },
  {
    name: 'B5 · a DOMException from another realm is recognized cross-realm',
    run: (ns) =>
      withRealm((realm) => {
        const foreign = new realm.DOMException('boom', 'SyntaxError');

        return (
          ns.isDOMException(foreign) === true &&
          ns.isError(foreign) === true &&
          ns.isGenericError(foreign) === false
        );
      }),
  },

  // ----- Layer B, continued — the same portable contract over the sources each
  // ENGINE renders, which V8 cannot (ADR #103) -----
  {
    name: 'B6 · a built-in renders a native source that carries the class signature',
    run: (ns) =>
      [Map, Object, Promise].every(
        (ctor) =>
          ns.doesUnboundNewableSourceMatchEitherClassSignature(
            Function.prototype.toString.call(ctor),
          ) === true && ns.isBuiltInClass(ctor) === true,
      ),
  },
  {
    name: 'B7 · a Proxy around a locked ES3 function reads native, and so as a class',
    run: (ns) => {
      // an unbound native newable: V8 and SpiderMonkey render it anonymously and
      // JavaScriptCore as `ProxyObject` — a fixed header either way, which is what
      // lets the native form be matched from the `function` keyword on
      const locked = function () {};
      Object.defineProperty(locked, 'prototype', { writable: false });
      const proxied = new Proxy(locked, {});

      return (
        ns.doesUnboundNewableSourceMatchEitherClassSignature(
          Function.prototype.toString.call(proxied),
        ) === true &&
        ns.isClass(proxied) === true &&
        ns.isES3Function(proxied) === false
      );
    },
  },
  {
    name: 'B8 · an ES3 body ending in a line comment reading `{ [native code]` is not native',
    run: (ns) => {
      const authored = function () {
        // { [native code]
      };

      return (
        ns.doesUnboundNewableSourceMatchEitherClassSignature(
          Function.prototype.toString.call(authored),
        ) === false
      );
    },
  },
  {
    name: 'B9 · a frozen ES3 function is ES3, and a frozen class a class',
    run: (ns) =>
      ns.isES3Function(Object.freeze(function () {})) === true &&
      ns.isClass(Object.freeze(function () {})) === false &&
      ns.isClass(
        Object.freeze(
          class {
            m() {}
          },
        ),
      ) === true &&
      ns.isES3Function(
        Object.freeze(
          class {
            m() {}
          },
        ),
      ) === false,
  },
];

// - the runner injects this file as a module `<script>` after the UMD bundle
//   and reads the array off the global; `export` is not reachable from
//   `page.evaluate`. See the note in function-introspection's twin.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
