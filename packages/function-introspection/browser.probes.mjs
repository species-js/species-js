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
 * A10 has since executed it, and it holds: Firefox 153 and WebKit 26.5 both
 * span three lines where Chromium 151 spans one. Worth recording how nearly it
 * was mis-corrected — every other probe condenses before comparing, and under
 * condensed output Firefox looks identical to V8 in every respect, which reads
 * as evidence that the SpiderMonkey half of the claim was wrong. It is not.
 * The normalization was doing its job, invisibly, which is the same reason the
 * claim survived so long unverified.
 *
 * ## Two layers, and why they assert different KINDS of thing
 *
 * **Layer A is an engine SURVEY.** It records, per engine, what
 * `Function.prototype.toString` yields for the forms this package reads. Those
 * values are facts about engines, not correctness claims — JSC names a bound
 * function's target where V8 and SpiderMonkey render it anonymously, and
 * neither is wrong. So layer A carries a PROFILE per engine, and a layer-A
 * failure means **the engine changed**: confirm the new value, then re-record.
 *
 * Asserting V8's answers everywhere was the first shape of this file, and it
 * made every JSC run red for something that is not a defect. A red meaning two
 * incompatible things is a red that stops being read.
 *
 * **Layer B is the library CONTRACT**, and it is identical on every engine. A
 * layer-B failure is a DEFECT — the module answering differently depending on
 * where it runs. B9 is the one that remains on WebKit: the false positive in
 * `concise.js` that breaks CONCISE's law L3.
 *
 * Two others were resolved rather than silenced, and in opposite ways. B7
 * failed because the strong predicate could not read mark 2 on JSC at all; it
 * was one member of a family — every bound form whose target carries a name —
 * which is why B14 now asserts the family rather than an instance, and why the
 * fix was a second reading of the source. B8 failed for the mirror reason: it
 * asserted a V8 accident as a portable contract, since V8 renders a callable
 * `Proxy` anonymously and JSC does not. There the fix was to stop reading the
 * source in the cascade at all (ADR #100), which made both engines agree on the
 * answer JSC already gave.
 *
 * The condensate itself is not on trial in either layer. It is a deterministic
 * transform and it does exactly what it is specified to do; what differs is the
 * string handed to it. Its consumers — the two `!== FOUNDATION` guards in
 * `concise.js` and the `===` in `bound.js` — are where an engine difference
 * turns into a wrong answer.
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
/** @type {(a: unknown) => Promise<unknown>} */
const asyncArrow = async (a) => a;
const asyncMethod = { async m() {} }.m;
const generatorMethod = { *m() {} }.m;
const asyncGeneratorMethod = { async *m() {} }.m;

/** The condensed form of an anonymous native function — the module's foundation. */
const NATIVE_ANONYMOUS = 'function(){[native code]}';

/**
 * Names a caller can install through `defineProperty`, none of them a valid
 * identifier.
 *
 * `name` is `configurable: true` on every function, so its value is chosen by
 * whoever holds the reference — and A5 established that JavaScriptCore renders
 * that value into the native source form. These are the strings that would
 * break a pattern permissive enough to accept "any name": one carrying
 * balanced punctuation, one carrying the marker itself, and the empty string.
 */
const ADVERSARIAL_NAMES = ['(){} evil', 'foo(){}', '', '[native code]'];

/**
 * What JavaScriptCore renders for each of those names, after condensing.
 *
 * Recorded from WebKit 26.5 rather than derived, because the condensing is
 * visible in them and worth reading: the space in `'(){} evil'` disappears on
 * both sides (adjacent to `)` and to `}`), while `'foo(){}'` keeps the space
 * after `function` because `foo` is a word character. The first entry is the
 * string that buys an admission — see B9.
 *
 * @type {Record<string, string>}
 */
const WEBKIT_ADVERSARIAL_FORMS = {
  '(){} evil': 'function(){}evil(){[native code]}',
  'foo(){}': 'function foo(){}(){[native code]}',
  '': 'function(){[native code]}',
  '[native code]': 'function[native code](){[native code]}',
};

/**
 * A bound function whose target carries `name`.
 *
 * Fresh per call, because each probe renames its own target and a shared one
 * would leak the last name into the next assertion.
 *
 * @param {string} name - the name to install before binding
 * @returns {(...args: unknown[]) => unknown} the bound function
 */
const boundWithName = (name) => {
  const target = function () {};

  Object.defineProperty(target, 'name', { value: name, configurable: true });

  return target.bind(null);
};

/** A named generator — a bound form with no `[[Construct]]` slot. */
const namedGenerator = function* namedGeneratorFunction() {};

/**
 * A named class — a bound form that keeps its `[[Construct]]` slot.
 *
 * Carries a member so it is not an empty class, which the lint rule reads as a
 * namespace object written in the wrong shape.
 */
class NamedClass {
  /** @returns {number} a value, so the body is not empty either */
  read() {
    return 1;
  }
}

/** The target A9 binds and then renames, to learn WHICH name is rendered. */
const provenanceTarget = function provenanceTarget() {};

/**
 * A genuinely bound function whose own `name` is overwritten AFTER binding.
 *
 * The discriminator A5 could not settle. A5 renamed the TARGET and watched the
 * rendered name follow, which is equally consistent with "the engine reads the
 * target's name" and with "the engine reads the bound value's own name minus
 * its `'bound '` prefix" — before a post-bind rename the two are the same
 * string. Renaming afterwards separates them.
 *
 * @param {string} name - the name to install after binding
 * @returns {(...args: unknown[]) => unknown} the renamed bound function
 */
const boundThenRenamed = (name) => {
  const bound = provenanceTarget.bind(null);

  Object.defineProperty(bound, 'name', { value: name, configurable: true });

  return bound;
};

/**
 * The raw, UNCONDENSED source's line count — the only reading that can settle
 * the "V8 emits a single line where JavaScriptCore and SpiderMonkey break it
 * across three" claim, since condensing is what erases the difference.
 *
 * @param {unknown} value - the callable to read
 * @returns {number} how many lines its source spans
 */
const rawSourceLines = (value) =>
  Function.prototype.toString.call(value).split('\n').length;

/**
 * @typedef {{ engine: string }} EngineContext
 */

/**
 * @typedef {{ name: string, run: (ns: Record<string, (...args: unknown[]) => unknown>, ctx: EngineContext) => boolean | string }} Probe
 */

/**
 * Selects the expectation recorded for the engine under test.
 *
 * Layer A asserts an engine PROFILE, not a portable contract. What an engine
 * returns from `Function.prototype.toString` for a bound function is a fact
 * about that engine, not a correctness question — JSC names the target where
 * V8 and SpiderMonkey do not, and neither is wrong. Asserting V8's answer
 * everywhere made every JSC run red for something that is not a defect, which
 * costs the red its meaning.
 *
 * With profiles, a layer-A failure means exactly one thing: **the engine
 * changed**. That is worth a red, and it is a different red from layer B's.
 *
 * @template T
 * @param {string} engine - the engine under test
 * @param {{ default: T } & Partial<Record<string, T>>} profiles - the recorded
 *  values, keyed by engine, with `default` covering the unlisted ones
 * @returns {T} the value recorded for this engine
 */
const perEngine = (engine, profiles) =>
  engine in profiles ? /** @type {T} */ (profiles[engine]) : profiles.default;

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
  // ----- Layer A — the engine SURVEY: what each engine returns, recorded -----
  {
    // The three examples published in `utility/index.d.ts`. A consumer reads
    // these; an engine that breaks them makes the published docs wrong there.
    name: 'A1 · the documented condensate examples, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return holds([
        [
          'Proxy.bind(null)',
          condense(Proxy.bind(null)),
          // JSC keeps the bound target's name; the `.d.ts` example records
          // only the V8 form, which is the documentation defect this pins.
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function Proxy(){[native code]}',
          }),
        ],
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
    name: 'A3 · how a bound function stringifies, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return holds([
        [
          'named.bind(null)',
          condense(named.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function namedFunction(){[native code]}',
          }),
        ],
        [
          'plain.bind(null)',
          condense(plain.bind(null)),
          // `plain` is an ANONYMOUS expression whose `.name` came from
          // NamedEvaluation — proof JSC reads a name, not `[[SourceText]]`.
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function plain(){[native code]}',
          }),
        ],
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
    name: 'A4 · how a Proxy over a user function stringifies, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return holds([
        [
          'Proxy over a named fn',
          condense(new Proxy(named, {})),
          // NOT the target's name — JSC names the exotic itself, so the value
          // is not reconstructible from the wrapped function.
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function ProxyObject(){[native code]}',
          }),
        ],
        // the negative half, expressed as an equality so the report shows the
        // value rather than only that a `!==` held
        ['an arrow must NOT read as native', condense(arrow), '(a)=> a'],
      ]);
    },
  },

  {
    // The discriminator for WHERE JSC's rendered name comes from.
    //
    // `toString` returns `[[SourceText]]`, which `defineProperty` cannot reach
    // — a renamed function still stringifies to its original characters on
    // every engine. But JSC renders `plain.bind(null)` as
    // `function plain(){[native code]}` even though that target's source text
    // is ANONYMOUS, so for the native form it must be reading a name rather
    // than the source. This asks which name.
    //
    // The expectations below are V8's, so this probe passes on V8 and
    // SpiderMonkey and FAILS on JSC — and what it reports there is the answer.
    // `foo`/`bar` means the mutable `name` property is read, and any
    // name-tolerant fix must treat that portion as caller-controlled.
    // `anon`/`declaredName` means an internal slot fixed at creation, which
    // `defineProperty` cannot forge.
    name: 'A5 · where the rendered native name comes from, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );
      // Fresh fixtures, declared here on purpose: renaming the module-scope
      // `plain` or `named` would corrupt A3, B5 and B7, which read them.
      const anon = function () {};
      const decl = function declaredName() {};

      Object.defineProperty(anon, 'name', { value: 'foo', configurable: true });
      Object.defineProperty(decl, 'name', { value: 'bar', configurable: true });

      return holds([
        ['anon.name after rename', anon.name, 'foo'],
        ['decl.name after rename', decl.name, 'bar'],
        // `[[SourceText]]` ignores the rename everywhere — the control that
        // proves the rename did not simply fail to apply
        ['decl source text', condense(decl), 'function declaredName(){}'],
        ['anon source text', condense(anon), 'function(){}'],
        // The discriminator. JSC's recorded profile is the RENAMED value, which
        // is what establishes that it reads the mutable `name` property rather
        // than a slot fixed at creation — `anon`/`declaredName` would have been
        // the other answer.
        [
          'anon.bind(null)',
          condense(anon.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function foo(){[native code]}',
          }),
        ],
        [
          'decl.bind(null)',
          condense(decl.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function bar(){[native code]}',
          }),
        ],
      ]);
    },
  },

  {
    // What a name-tolerant pattern would have to survive. A5 showed JSC
    // renders the caller's `name`; this asks whether it renders it VERBATIM.
    // If it does, `function (){} evil(){[native code]}` is a string a caller
    // can produce at will, and a pattern with `.*` in the name slot would
    // match it — so the slot needs a character class, not a wildcard.
    name: 'A6 · what an adversarial `name` renders as, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      // The control: an UNBOUND target keeps its `[[SourceText]]` whatever its
      // `name` says. Without a claim expecting something other than the native
      // constant, a condensate stubbed to that constant would pass this probe
      // while reading nothing.
      const unbound = function () {};

      Object.defineProperty(unbound, 'name', {
        value: '(){} evil',
        configurable: true,
      });

      return holds([
        ...ADVERSARIAL_NAMES.map(
          (name) =>
            /** @type {[string, unknown, unknown]} */ ([
              `bound target named ${JSON.stringify(name)}`,
              condense(boundWithName(name)),
              perEngine(engine, {
                default: NATIVE_ANONYMOUS,
                webkit: WEBKIT_ADVERSARIAL_FORMS[name],
              }),
            ]),
        ),
        ['unbound target, adversarial name', condense(unbound), 'function(){}'],
      ]);
    },
  },

  // - A7 to A10 record the protocol the earlier profiles left implicit. A3 and
  //   A5 established that JavaScriptCore renders A name into the native form,
  //   but not WHICH name, not what it does for a bound NATIVE or a double-bound
  //   value, and not whether the raw form really spans three lines — a claim
  //   `utility/index.js` makes about two engines and that nothing has executed.
  //
  //   Their `default` profile is V8's, measured under Node against the real
  //   implementations. `webkit` and `firefox` are DELIBERATELY unrecorded: the
  //   first dispatch is expected to fail on them, and `holds` prints the
  //   observed strings, which ARE the protocol. Recording them turns these
  //   green, after which a red means the engine changed — layer A's usual
  //   meaning.
  {
    name: 'A7 · what the realm probe answers, per engine',
    run: (ns, { engine }) => {
      const hasJSCBehavior = /** @type {() => boolean} */ (
        /** @type {unknown} */ (ns.hasJavaScriptCoreBindBehavior)
      );

      return holds([
        [
          'hasJavaScriptCoreBindBehavior()',
          hasJSCBehavior(),
          perEngine(engine, { default: false, webkit: true }),
        ],
      ]);
    },
  },
  {
    // The gap A3 left: it measured two USER functions. A bound native and a
    // double-bound value are the forms `bound.js` reconstructs an expected
    // source for, and neither has ever been observed off V8.
    name: 'A8 · how every bound form stringifies, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );

      return holds([
        [
          'arrow.bind(null)',
          condense(arrow.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function arrow(){[native code]}',
          }),
        ],
        [
          'method.bind(null)',
          condense(method.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function m(){[native code]}',
          }),
        ],
        [
          'namedGenerator.bind(null)',
          condense(namedGenerator.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function namedGeneratorFunction(){[native code]}',
          }),
        ],
        [
          'NamedClass.bind(null)',
          condense(NamedClass.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function NamedClass(){[native code]}',
          }),
        ],
        // the native pair. On WebKit `Math.max.bind(null)` renders EXACTLY what
        // `Math.max` renders — A2 records the same string for the unbound one —
        // so on that engine the source carries no bound/unbound distinction for
        // a native at all.
        [
          'Math.max.bind(null)',
          condense(Math.max.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function max(){[native code]}',
          }),
        ],
        [
          'Array.bind(null)',
          condense(Array.bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function Array(){[native code]}',
          }),
        ],
        // double-bound: its target is itself a bound function named
        // `'bound namedFunction'`, and WebKit renders that name verbatim. This
        // is what makes stripping exactly ONE `'bound '` prefix correct in
        // `createExpectedJSCSpecificFunctionSourceFromBoundName` — a rule that
        // was reasoned before this probe and is measured by it.
        [
          'named.bind(null).bind(null)',
          condense(named.bind(null).bind(null)),
          perEngine(engine, {
            default: NATIVE_ANONYMOUS,
            webkit: 'function bound namedFunction(){[native code]}',
          }),
        ],
        // positive controls — every expectation above is one constant on V8, so
        // without these a condensate stubbed to it would pass reading nothing
        ['Math.max (unbound)', condense(Math.max), 'function max(){[native code]}'],
        ['arrow (unbound)', condense(arrow), '(a)=> a'],
      ]);
    },
  },
  {
    // Which name a name-rendering engine reads — SETTLED here, and it is the
    // TARGET's. A5 could not separate that from "the bound value's own name,
    // minus its prefix", because before a post-bind rename those are the same
    // string. Renaming afterwards moves one and not the other, and WebKit 26.5
    // renders `provenanceTarget` in both rows below: unmoved by a rename of the
    // value itself, including one that installs a fresh `'bound '` prefix.
    //
    // Two consequences worth keeping. The rendered name slot is caller-chosen
    // only BEFORE binding, never after — so `bound.js`'s reconstruction reads a
    // name the caller can pick, but not one they can change behind its back.
    // And a value whose own name was overwritten after binding cannot be
    // reconstructed at all on this engine: mark 3 is gone and the rendered name
    // no longer corresponds to anything readable on the value.
    name: 'A9 · which name a name-rendering engine reads, per engine',
    run: (ns, { engine }) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );
      const targetNameForm = perEngine(engine, {
        default: NATIVE_ANONYMOUS,
        webkit: 'function provenanceTarget(){[native code]}',
      });

      return holds([
        [
          'bound, renamed "renamed"',
          condense(boundThenRenamed('renamed')),
          targetNameForm,
        ],
        [
          'bound, renamed "bound other"',
          condense(boundThenRenamed('bound other')),
          targetNameForm,
        ],
        // the control: `[[SourceText]]` ignores every rename on every engine,
        // so the UNBOUND target must still read as written
        [
          'provenanceTarget (unbound)',
          condense(provenanceTarget),
          'function provenanceTarget(){}',
        ],
      ]);
    },
  },
  {
    // The oldest unexecuted claim in the package, and it holds. `utility/
    // index.js` states that "V8 emits a single line where JavaScriptCore and
    // SpiderMonkey break it across three"; measured, Firefox 153 and WebKit 26.5
    // both span three lines where Chromium 151 spans one.
    //
    // It went unverified for so long because every other probe condenses first,
    // and condensing is exactly what erases this difference — which is what the
    // condensate is FOR. Reading only condensed output had made Firefox look
    // like it matched V8 in every respect. It does not; the normalization was
    // doing its job silently.
    name: 'A10 · how many lines the RAW native form spans, per engine',
    run: (ns, { engine }) => {
      void ns;

      const nativeFormLines = perEngine(engine, { default: 1, firefox: 3, webkit: 3 });

      return holds([
        ['Math.max (unbound native)', rawSourceLines(Math.max), nativeFormLines],
        ['named.bind(null) (bound)', rawSourceLines(named.bind(null)), nativeFormLines],
        // the control: ordinary source is not reformatted by any engine, so a
        // one-line arrow stays one line and a reader that always answered `1`
        // would be caught by the two-line function below
        ['arrow (ordinary source)', rawSourceLines(arrow), 1],
        [
          'a deliberately two-line function',
          rawSourceLines(function twoLines() {
            return 1;
          }),
          3,
        ],
      ]);
    },
  },

  // ----- Layer B — the library CONTRACT: identical on every engine -----
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
    // B8's first claim used to expect `true`, and it was the one probe here that
    // asserted a V8 accident as a portable contract: V8 renders a callable Proxy
    // anonymously, so mark 2 fired for a value that was never bound. JSC names
    // the exotic and answered `false` — the more truthful of the two. Since ADR
    // #100 the cascade reads no source at all and both engines answer `false`,
    // which makes this a real contract rather than a divergence.
    name: 'B8 · the mark/strength split holds for a Proxy, and a native is neither',
    run: (ns) =>
      holds([
        // a Proxy over an UNBOUND callable forwards that target's ordinary name
        [
          'indicates(Proxy over method)',
          ns.doesIndicateBoundFunction(new Proxy(method, {})),
          false,
        ],
        // ...while a Proxy over a BOUND one forwards a `'bound '` name, which is
        // the case this change could silently have broken
        [
          'indicates(Proxy over a bound function)',
          ns.doesIndicateBoundFunction(new Proxy(named.bind(null), {})),
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
  {
    // The question that actually matters. CONCISE's standing law L3 says every
    // failure of this module is a MISS — it may decline to recognize, it may
    // never wrongly admit. On JSC the source a caller can influence is fed to
    // the same shape matchers, so this asks whether a chosen `name` can buy an
    // ADMISSION. A miss here would be a divergence; a false positive would
    // break the invariant the `is` prefix is priced on (#090).
    name: 'B9 · an adversarial `name` cannot buy a false positive',
    run: (ns) =>
      holds([
        ...ADVERSARIAL_NAMES.flatMap((name) => {
          const label = JSON.stringify(name);

          return /** @type {[string, unknown, unknown][]} */ ([
            [
              `plainConcise(bound ${label})`,
              ns.isPlainConciseMethod(boundWithName(name)),
              false,
            ],
            [
              `anyConcise(bound ${label})`,
              ns.isAnyConciseMethod(boundWithName(name)),
              false,
            ],
            [`arrow(bound ${label})`, ns.isArrowFunction(boundWithName(name)), false],
          ]);
        }),
        // positive control — every expectation above is `false`, so without
        // this a predicate stubbed to that constant would pass reading nothing
        ['anyConcise(method)', ns.isAnyConciseMethod(method), true],
      ]),
  },

  // - B10 to B12 close the measurement gap. Six of the eleven public exports
  //   had cross-engine evidence; these five had none, and "no probe touched
  //   it" is not the same as "it is fine". Every expectation is V8's measured
  //   answer, taken before the probes were written.
  {
    name: 'B10 · the arrow pair, which read no native form at all',
    run: (ns) =>
      holds([
        ['asyncArrow is an async arrow', ns.isAsyncArrowFunction(asyncArrow), true],
        ['a plain arrow is not', ns.isAsyncArrowFunction(arrow), false],
        ['a plain arrow IS any-arrow', ns.isAnyArrowFunction(arrow), true],
        ['an async arrow IS any-arrow', ns.isAnyArrowFunction(asyncArrow), true],
        ['a function expression is not', ns.isAnyArrowFunction(plain), false],
        ['a concise method is not', ns.isAnyArrowFunction(method), false],
      ]),
  },
  {
    // Also asserts CONCISE's law L2 across the flavours — no value is admitted
    // by more than one — which is the property a shared source reader is most
    // likely to lose if an engine hands it a different string.
    name: 'B11 · each concise flavour admits its own shape and refuses the others',
    run: (ns) =>
      holds([
        ['async', ns.isConciseAsyncMethod(asyncMethod), true],
        ['generator', ns.isConciseGeneratorMethod(generatorMethod), true],
        ['asyncGenerator', ns.isConciseAsyncGeneratorMethod(asyncGeneratorMethod), true],
        ['async is not a generator', ns.isConciseGeneratorMethod(asyncMethod), false],
        ['generator is not async', ns.isConciseAsyncMethod(generatorMethod), false],
        [
          'asyncGenerator is not plain async',
          ns.isConciseAsyncMethod(asyncGeneratorMethod),
          false,
        ],
        ['a plain method is none of them', ns.isConciseAsyncMethod(method), false],
      ]),
  },
  {
    // The one that matters. B9 showed `'(){} evil'` buying an admission from
    // `isPlainConciseMethod` and `isAnyConciseMethod` on JSC; this asks whether
    // the same input buys one from any of the five that were never measured.
    // A `true` in any of the fifteen below is another L3 break.
    name: 'B12 · the JSC-exposed inputs, against all five unmeasured predicates',
    run: (ns) => {
      const hostile = {
        'bound method': method.bind(null),
        'Proxy over method': new Proxy(method, {}),
        'adversarially named bound fn': boundWithName('(){} evil'),
      };
      const predicates = {
        asyncArrow: ns.isAsyncArrowFunction,
        anyArrow: ns.isAnyArrowFunction,
        conciseAsync: ns.isConciseAsyncMethod,
        conciseGenerator: ns.isConciseGeneratorMethod,
        conciseAsyncGenerator: ns.isConciseAsyncGeneratorMethod,
      };

      return holds([
        ...Object.entries(hostile).flatMap(([inputLabel, value]) =>
          Object.entries(predicates).map(
            ([predicateLabel, predicate]) =>
              /** @type {[string, unknown, unknown]} */ ([
                `${predicateLabel}(${inputLabel})`,
                predicate(value),
                false,
              ]),
          ),
        ),
        // positive controls, one per family — without them a pair of
        // predicates stubbed to `false` would pass all fifteen claims above
        ['anyArrow(arrow)', ns.isAnyArrowFunction(arrow), true],
        ['conciseAsync(asyncMethod)', ns.isConciseAsyncMethod(asyncMethod), true],
      ]);
    },
  },

  // - B13 and B14 are the contract the two-implementation split creates. Before
  //   it, "a bound value is strongly indicated" held on V8 and failed on JSC for
  //   every bound form whose target carries a name, and no probe said so: B7
  //   asserted one such value and was read as one finding rather than a family.
  {
    // The probe must describe the engine it is running on. A realm reporting
    // `false` while rendering a name selects the reading that cannot fire
    // there — silently, and for every caller.
    name: 'B13 · the realm probe agrees with what this engine renders',
    run: (ns) => {
      const condense = /** @type {(v: unknown) => string | undefined} */ (
        /** @type {unknown} */ (ns.getCondensedFunctionSource)
      );
      const hasJSCBehavior = /** @type {() => boolean} */ (
        /** @type {unknown} */ (ns.hasJavaScriptCoreBindBehavior)
      );

      return holds([
        [
          'probe === (a bound form renders non-anonymously)',
          hasJSCBehavior(),
          condense(named.bind(null)) !== NATIVE_ANONYMOUS,
        ],
        // the control — both sides above are engine-derived, so without a fixed
        // expectation a stubbed condensate would satisfy the equality
        ['named (unbound)', condense(named), 'function namedFunction(){}'],
      ]);
    },
  },
  {
    // The recall contract. Every genuinely bound form must be admitted by the
    // conjunction on EVERY engine — that is what the JavaScriptCore-specific
    // reading exists to restore, and the claim `dSIBF/A1`-`A10` make.
    name: 'B14 · every genuinely bound form is strongly indicated, on every engine',
    run: (ns) => {
      const strongly = ns.doesStronglyIndicateBoundFunction;

      return holds([
        ['strongly(named.bind)', strongly(named.bind(null)), true],
        ['strongly(arrow.bind)', strongly(arrow.bind(null)), true],
        ['strongly(method.bind)', strongly(method.bind(null)), true],
        ['strongly(namedGenerator.bind)', strongly(namedGenerator.bind(null)), true],
        ['strongly(NamedClass.bind)', strongly(NamedClass.bind(null)), true],
        ['strongly(Math.max.bind)', strongly(Math.max.bind(null)), true],
        ['strongly(Array.bind)', strongly(Array.bind(null)), true],
        ['strongly(double-bound)', strongly(named.bind(null).bind(null)), true],
        // the precision half — these must stay refused everywhere, and they are
        // the negative controls for the eight claims above
        ['strongly(named)', strongly(named), false],
        ['strongly(Function.prototype)', strongly(Function.prototype), false],
        ['strongly(bound, then renamed)', strongly(boundThenRenamed('x')), false],
      ]);
    },
  },
];

// - the runner injects this file into the page as a module `<script>` after the
//   UMD bundle, then reads the array back off the global. A module's `export`
//   is not reachable from `page.evaluate`, which sees only the page's global
//   scope; the `export` above is what lets Node-side tooling read the same
//   file. Both consumers, one definition.
/** @type {Record<string, unknown>} */ (globalThis).__speciesBrowserProbes = probes;
