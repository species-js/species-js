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
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>) => boolean | string }} Probe
 */

/**
 * Answers `true` when every claim holds, otherwise a report of what differed.
 *
 * A probe that can only answer `false` names the engine that disagreed and
 * nothing else — which, for a check whose entire purpose is to learn what
 * another engine emits, is one dispatch short of the answer. WebKit's first
 * run cost exactly that round trip. Reporting the observed string turns a red
 * run into a finding.
 *
 * @param {[string, unknown, unknown][]} claims - label, actual, expected
 * @returns {true | string} true when all hold, else the differences
 */
const holds = (claims) => {
  const broken = claims
    .filter(([, actual, expected]) => actual !== expected)
    .map(
      ([label, actual, expected]) =>
        `${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`,
    );

  return broken.length === 0 ? true : broken.join('\n      ');
};

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

      return holds([
        ['Proxy.bind(null)', condense(Proxy.bind(null)), NATIVE_ANONYMOUS],
        ['Proxy', condense(Proxy), 'function Proxy(){[native code]}'],
        ['(a) => a', condense(arrow), '(a)=> a'],
      ]);
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

      return holds([
        ['Math.max', condense(Math.max), 'function max(){[native code]}'],
        [
          'Function.prototype.bind',
          condense(Function.prototype.bind),
          'function bind(){[native code]}',
        ],
      ]);
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

      return holds([
        ['named.bind(null)', condense(named.bind(null)), NATIVE_ANONYMOUS],
        ['plain.bind(null)', condense(plain.bind(null)), NATIVE_ANONYMOUS],
        // the negative half: the UNBOUND original must not answer the native
        // form, or a condensate stubbed to that constant would pass the two
        // assertions above while reading nothing.
        ['named (unbound)', condense(named), 'function namedFunction(){}'],
      ]);
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

      return holds([
        ['Proxy over a named fn', condense(new Proxy(named, {})), NATIVE_ANONYMOUS],
        // the negative half, expressed as an equality so the report shows the
        // value rather than only that a `!==` held
        ['an arrow must NOT read as native', condense(arrow), '(a)=> a'],
      ]);
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

  // - B5 to B8 exist because of what WebKit answered on 2026-09-04.
  //   JavaScriptCore keeps the target's NAME in the native form where V8 and
  //   SpiderMonkey emit it anonymously, so `condense(f.bind())` is
  //   `function f(){[native code]}` there rather than the foundation constant.
  //   That constant is compared by `===` in `bound.js` and by `!==` in two
  //   `concise.js` guards, so an engine where the equality never holds is an
  //   engine where those guards may quietly stop discriminating. The four
  //   probes below are the inputs that reach them; every expectation is the
  //   value V8 actually answers, measured rather than assumed.
  {
    name: 'B5 · a bound function is not a concise method',
    run: (ns) =>
      holds([
        ['plainConcise(named.bind)', ns.isPlainConciseMethod(named.bind(null)), false],
        ['anyConcise(named.bind)', ns.isAnyConciseMethod(named.bind(null)), false],
        ['plainConcise(method.bind)', ns.isPlainConciseMethod(method.bind(null)), false],
        ['anyConcise(method.bind)', ns.isAnyConciseMethod(method.bind(null)), false],
        // positive control — without it every expectation here is `false` and
        // a predicate stubbed to that constant passes while reading nothing
        ['anyConcise(method)', ns.isAnyConciseMethod(method), true],
      ]),
  },
  {
    name: 'B6 · a Proxy-wrapped callable is not a concise method',
    run: (ns) =>
      holds([
        [
          'plainConcise(Proxy over named)',
          ns.isPlainConciseMethod(new Proxy(named, {})),
          false,
        ],
        [
          'anyConcise(Proxy over named)',
          ns.isAnyConciseMethod(new Proxy(named, {})),
          false,
        ],
        // the sharper case: the target IS a concise method, so only the
        // native-form reading keeps the Proxy out
        [
          'plainConcise(Proxy over method)',
          ns.isPlainConciseMethod(new Proxy(method, {})),
          false,
        ],
        [
          'anyConcise(Proxy over method)',
          ns.isAnyConciseMethod(new Proxy(method, {})),
          false,
        ],
        // the positive control — the unwrapped method is still admitted
        ['plainConcise(method)', ns.isPlainConciseMethod(method), true],
      ]),
  },
  {
    name: 'B7 · bound indication and its STRENGTH both survive',
    run: (ns) =>
      holds([
        ['indicates(named.bind)', ns.doesIndicateBoundFunction(named.bind(null)), true],
        [
          'strongly(named.bind)',
          ns.doesStronglyIndicateBoundFunction(named.bind(null)),
          true,
        ],
        ['indicates(named)', ns.doesIndicateBoundFunction(named), false],
      ]),
  },
  {
    name: 'B8 · the mark/strength split holds for a Proxy, and a native is neither',
    run: (ns) =>
      holds([
        // a Proxy over a concise method carries the MARK but not the strength
        [
          'indicates(Proxy over method)',
          ns.doesIndicateBoundFunction(new Proxy(method, {})),
          true,
        ],
        [
          'strongly(Proxy over method)',
          ns.doesStronglyIndicateBoundFunction(new Proxy(method, {})),
          false,
        ],
        [
          'indicates(Proxy over named)',
          ns.doesIndicateBoundFunction(new Proxy(named, {})),
          false,
        ],
        ['indicates(Math.max)', ns.doesIndicateBoundFunction(Math.max), false],
        ['plainConcise(Math.max)', ns.isPlainConciseMethod(Math.max), false],
      ]),
  },
];

// - the runner injects this file into the page as a module `<script>` after the
//   UMD bundle, then reads the array back off the global. A module's `export`
//   is not reachable from `page.evaluate`, which sees only the page's global
//   scope; the `export` above is what lets Node-side tooling read the same
//   file. Both consumers, one definition.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
