// @ts-check

/**
 * @module browser.probes
 *
 * Cross-engine probes for the built UMD bundle, run by
 * `scripts/check-browser-contract.mjs` in Chromium, Firefox and WebKit.
 *
 * These are not a third test suite. The 1674 specs test the source and
 * `smoke.probes.mjs` tests the bundle; both run on V8 alone, under Node. This
 * file asks the one question neither can: **do the other two engines agree?**
 *
 * The question is not rhetorical here. `src/utility/index.js` states as
 * documented fact that "V8 emits a single line where JavaScriptCore and
 * SpiderMonkey break it across three", and the whole condensate exists to
 * normalize that difference. Until this file ran, that claim named two engines
 * and had been executed on neither. Everything in `bound`, `arrow` and
 * `concise` reads source through that normalization, so if it is wrong on an
 * engine, every predicate downstream is wrong there too — silently.
 *
 * ## Two layers, and why the distinction matters
 *
 * **Layer A** pins the condensed source character for character, including the
 * three examples published in `utility/index.d.ts`. These are claims a consumer
 * can read, so an engine that breaks them makes the documentation wrong for
 * that engine.
 *
 * **Layer B** pins the predicate verdicts that rest on layer A.
 *
 * Read a failure by which layer moved. A failing on its own means the
 * documented strings are V8-specific while the library still classifies
 * correctly — a documentation defect. A and B failing together is a real
 * classification bug on that engine. B failing while A holds would mean the
 * divergence is somewhere other than the source form.
 */

// Typed from ABOVE, never inline — these fixtures are read through
// `Function.prototype.toString`, so an inline annotation would change the very
// source text under test. Layer A asserts `(a)=> a` character for character.
/** @type {(a: unknown) => unknown} */
const arrow = (a) => a;
const plain = function () {};
const named = function namedFunction() {};
const method = { m() {} }.m;
const methodNamedAsync = { async() {} }.async;

/** The condensed form of an anonymous native function — the module's foundation. */
const NATIVE_ANONYMOUS = 'function(){[native code]}';

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean }} Probe
 */

/** @type {Probe[]} */
export const probes = [
  // ----- Layer A — the condensed source, character for character -----
  {
    // The three examples published in `utility/index.d.ts`. A consumer reads
    // these; an engine that breaks them makes the published docs wrong there.
    name: 'A1 · the documented condensate examples hold',
    run: (ns) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return (
        condense(Proxy.bind(null)) === NATIVE_ANONYMOUS &&
        condense(Proxy) === 'function Proxy(){[native code]}' &&
        condense(arrow) === '(a)=> a'
      );
    },
  },
  {
    // A named built-in keeps its name through the condensate; the anonymous
    // foundation does not cover this case, and the two are the axis on which
    // engines most plausibly differ.
    name: 'A2 · a native built-in condenses to the NAMED native form',
    run: (ns) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return (
        condense(Math.max) === 'function max(){[native code]}' &&
        condense(Function.prototype.bind) === 'function bind(){[native code]}'
      );
    },
  },
  {
    // The likeliest single divergence in this file. V8 stringifies a bound
    // function anonymously; an engine that instead emits a `bound f` name
    // would condense to something the foundation comparison misses, and
    // `doesIndicateBoundFunction` reads exactly this.
    name: 'A3 · a bound function condenses to the ANONYMOUS native form',
    run: (ns) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return (
        condense(named.bind(null)) === NATIVE_ANONYMOUS &&
        condense(plain.bind(null)) === NATIVE_ANONYMOUS &&
        // the negative half: the UNBOUND original must not answer the native
        // form, or a condensate stubbed to that constant would pass the two
        // assertions above while reading nothing.
        condense(named) === 'function namedFunction(){}'
      );
    },
  },
  {
    // A Proxy exotic object with [[Call]] has no [[SourceText]], so the spec
    // sends it to the NativeFunction form — a place engines could disagree
    // about the name slot just as they might for a bound function.
    name: 'A4 · a Proxy over a user function condenses to the anonymous form',
    run: (ns) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return (
        condense(new Proxy(named, {})) === NATIVE_ANONYMOUS &&
        condense(arrow) !== NATIVE_ANONYMOUS
      );
    },
  },

  // ----- Layer B — the verdicts that rest on layer A -----
  {
    name: 'B1 · bound-function indication survives the engine source form',
    run: (ns) => {
      const indicates = ns.doesIndicateBoundFunction;

      return indicates(named.bind(null)) === true && indicates(named) === false;
    },
  },
  {
    name: 'B2 · arrow classification survives the engine source form',
    run: (ns) => {
      const isArrow = ns.isArrowFunction;

      return isArrow(arrow) === true && isArrow(plain) === false;
    },
  },
  {
    name: 'B3 · concise-method classification survives the engine source form',
    run: (ns) => {
      const isConcise = ns.isPlainConciseMethod;

      return isConcise(method) === true && isConcise(plain) === false;
    },
  },
  {
    // The `iAnyCM/A2` regression vector, carried across engines. A method
    // NAMED `async` has an async arrow's head, so nothing but the tag read
    // separates them — and the tag is engine-provided.
    name: 'B4 · the union admits a plain method named `async`',
    run: (ns) => {
      const isAny = ns.isAnyConciseMethod;

      return isAny(methodNamedAsync) === true && isAny(arrow) === false;
    },
  },
];

// - the runner injects this file into the page as a module `<script>` after the
//   UMD bundle, then reads the array back off the global. A module's `export`
//   is not reachable from `page.evaluate`, which sees only the page's global
//   scope; the `export` above is what lets Node-side tooling read the same
//   file. Both consumers, one definition.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
