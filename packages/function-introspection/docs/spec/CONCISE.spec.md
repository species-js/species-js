# concise — behavioral specification

> Spec format and the multi-axis model are defined in
> [type-detection's spec README](../../../type-detection/docs/spec/README.md); this
> package follows the same model and does not restate it. Vectors are reasoned from the
> canon (`concise.js`, `concise.d.ts`, `UTILITY.spec.md`, decisions #087, #088 and #090).
> Status: **FROZEN 2026-08-11** — decidability check passed: every vector below was
> executed against the real predicates through the `#index` barrel before freezing,
> including all eleven numeric key spellings, the private key, the undecidable and
> decidable pairs, the accessor-slot law, the five helper contracts, and the three illegal
> headers asserted to be `SyntaxError`. This spec is the base for the axis-1 suite; axes
> 2–5 derive alongside.
>
> **One vector was corrected by that run** (`iPCM/R10`): it had claimed a method whose
> body contains another method's text is refused. It is not — it is admitted on its own
> head, which is the whole point of reading the head only. The rejection vector uses a
> non-method host and the admission is stated separately as `iPCM/A9`. See Resolved
> item 1.

## Module contract

`function-introspection / concise` answers one question: **which shorthand method
definition, if any, did this function come from?**

A method is not structurally distinguishable from the function it resembles.
`[[HomeObject]]`, the slot only a method carries, has no observable channel. The answer
comes from `[[SourceText]]` — read through the realm-fixed `Function.prototype.toString` —
combined with signals a caller cannot forge: the spec-defined tag, and the presence of an
own `prototype`.

```
entrance-level:  isFunction(value)
      │
      ├── source starts `*`              + GeneratorFunction tag       → isConciseGeneratorMethod
      ├── source starts `async` … `*`    + AsyncGeneratorFunction tag  → isConciseAsyncGeneratorMethod
      ├── source starts `async` KEY `(`  + AsyncFunction tag           → isConciseAsyncMethod
      ├── source starts KEY `(`          + not async, and for a
      │                                    `function` head also
      │                                    !hasOwnPrototype && !native → isPlainConciseMethod
      └── any of the four                                             → isAnyConciseMethod
```

**Only the source HEAD is read, never the body.** A method whose body contains an arrow,
or the literal text of another method, is classified by its own head and nothing else.

These predicates are named `is…` under **#090**. Every admission rests on the source read
through a realm-fixed intrinsic, a spec-defined tag, or an own-`prototype` read. Where a
shape could belong to two kinds, a non-forgeable signal settles it. Where no such signal
exists, the answer is refused rather than guessed. Every boundary below is therefore
silence, never a wrong answer.

### Reading order (white-box, load-bearing)

Every predicate tests the source before consulting a flavor tag. Tag predicates are cheap
when they SUCCEED and roughly two orders of magnitude dearer when they REJECT. So the rule
is **never let a flavor tag reject**: reach one only where the source shape says it will
succeed.

`isFunction` is the deliberate exception and runs first. It is the floor-level `typeof`
test, priced the same either way, and it keeps `getFunctionSource` from absorbing a
`TypeError` — measured at ~8 µs per non-callable when absent, against 0.04 µs with it (see
`UTILITY.spec.md` → `gCFS/A4`). Guarding callability early and reaching a flavor tag late
are separate rules; the second does not follow from the first.

**Gate scoping.** `!hasOwnPrototype` and the native-source subtraction apply **only to a
`function` head**, not to every key. Of everything carrying an own `prototype`, only the
anonymous function expression reaches the plain-method pattern at all. Named function
expressions, generator functions, generator and async-generator methods and class
constructors are already refused by the pattern. Applied to every key, the gate cost
recall on methods that had merely been GIVEN a `prototype`, for no precision gain.

## Surface inventory

| Export                                                     | Visibility  | `@@throw-safe` |
| ---------------------------------------------------------- | ----------- | -------------- |
| `isPlainConciseMethod`                                     | public      | yes            |
| `isConciseAsyncMethod`                                     | public      | yes            |
| `isConciseGeneratorMethod`                                 | public      | yes            |
| `isConciseAsyncGeneratorMethod`                            | public      | yes            |
| `isAnyConciseMethod`                                       | public      | yes            |
| `matchesLeadingAsyncToken`                                 | `@internal` | yes            |
| `matchesStartSequencesOfConciseAsyncGeneratorMethodSource` | `@internal` | yes            |
| `matchesStartSequencesOfConciseAsyncMethodSource`          | `@internal` | yes            |
| `matchesStartSequencesOfConciseMethodNormalForm`           | `@internal` | yes            |
| `matchesStartSequencesOfUnnamedPlainFunctionSource`        | `@internal` | yes            |

## What a key may be

The key class is `(?:#?ID | NUMERIC | quoted | computed)`, and it is **not** the same
class `arrow` uses for a parameter: a key may begin with a digit, a parameter may not.

- `key/A1` — identifier keys, including the spellings a narrow letter class refused: ZWNJ,
  ZWJ, a combining mark, Devanagari, and a unicode escape.
- `key/A2` — private keys (`#p(){}`), in a class body.
- `key/A3` — quoted keys, single and double, including one containing a `]` (`'a]b'(){}`).
- `key/A4` — computed keys (`['k'](){}`), including a computed key whose expression
  contains `]` — the pattern is greedy (`\[[\s\S]*\]`), which is safe because `^\[` can
  only be a computed-key method; a computed ACCESSOR still leads with `get`/`set`.
- `key/A5` — symbol keys.
- `key/A6` — **all eleven numeric spellings**: `1`, `1.5`, `.5`, `1.`, `1e3`, `1e-3`,
  `0x10`, `0b101`, `0o17`, `1_000`, `1n`. Three of them — `.5`, `1e-3` and `1.` — were
  silently refused by an earlier class and are the reason a separate numeric branch
  exists.
- `key/A7` — keyword-shaped keys: `async(){}`, `function(){}`, `get(){}`, `set(){}`,
  `static(){}`, `asyncFoo(){}`, `functionFoo(){}`. Each puts a keyword at the head and
  must not be mistaken for a modifier — a `(?!async|function)` lookahead once matched a
  PREFIX and killed `async()`, `asyncFoo()` and `functionFoo()`.

## Cross-cutting vectors — the entrance-level

- `concise/X1` — `undefined`, `null`, `42`, `'x'`, `{}`, `[]`, `Symbol()`, `0n`, `true` →
  false — not callable. A string spelling a method is included: values are classified,
  never text.
- `concise/X2` — an omitted call `p()` → false (#079 honest-by-construction).
- `concise/X3` — the hostile callables (revoked `Proxy`, throwing `get` trap, throwing
  `getOwnPropertyDescriptor` trap, null-prototype callable) → false, never a throw.
- `concise/X4` — an unreadable source yields `''` and is refused; no predicate
  distinguishes "unreadable" from "not a method".

## `isPlainConciseMethod`

`isPlainConciseMethod(value?: unknown): boolean` — the unmodified method, `foo() {}`, in
every key form.

**Admits**

- `iPCM/A1` — `({ foo() {} }).foo` → true.
- `iPCM/A2` — `({ foo(){} }).foo` → true — tight spelling.
- `iPCM/A3` — every key form of `key/A1`–`A7` without a modifier → true.
- `iPCM/A4` — `({ function(){} }).function` → true — **a method named `function`.**
  Decided because the function expression it resembles is constructable and carries an own
  `prototype`; the method does not. See the decidable pair below.
- `iPCM/A5` — class prototype methods and `static` methods → true — `static` never appears
  in `[[SourceText]]`.
- `iPCM/A6` — a method separated from its parameter list by full trivia: `foo\n() {}`,
  `foo // c\n() {}`, `foo /*\n\n*/ () {}` → true. The key-to-`(` slot admits newlines,
  line comments and multi-line block comments alike.
- `iPCM/A7` — a cross-realm concise method → true.
- `iPCM/A8` — a method that was GIVEN an own `prototype` after the fact → true — the gate
  is scoped to the `function` head, so ordinary, string and private keys keep their
  recall.
- `iPCM/A9` — a method whose BODY contains an arrow or another method's text → true. It is
  classified by its own head; the body is never read. Paired with `iPCM/R10`, which is the
  same fact seen from a non-method host.

**Rejects**

- `iPCM/R1` — `(function () {})` → false — anonymous function expression: it matches the
  pattern, and the scoped `!hasOwnPrototype` read is what separates it.
- `iPCM/R2` — `(function f() {})` → false — refused by the pattern alone (a name follows
  the keyword).
- `iPCM/R3` — every modified flavor: `async foo(){}`, `*foo(){}`, `async *foo(){}` →
  false.
- `iPCM/R4` — accessor syntax, `get x(){}` / `set x(v){}`, in object and class hosts →
  false. See Accessors.
- `iPCM/R5` — arrows of both flavors → false, including the parenthesized async arrow
  `async (x) => x`, whose head is a method-shaped `async(`; the scoped async check refuses
  it.
- `iPCM/R6` — `class C {}` and a class constructor → false.
- `iPCM/R7` — `Math.max` and other natives → false — the `[native code]` form.
- `iPCM/R8` — `({ foo(){} }).foo.bind(null)` → false — **documented boundary**, bound.
- `iPCM/R9` — a `Proxy` wrapping a method, and `Function.prototype` → false.
- `iPCM/R10` — a NON-method whose body contains the text of a method → false:
  `(function f() { return ({ inner(){} }).inner; })` and `() => ({ inner(){} }).inner`.
  **The head decides, and only the head** — the inner text is never reached. Note the
  converse holds too and is an ADMISSION, not a rejection: a method whose body contains an
  arrow is still a method (`iPCM/A9`), because it is classified by its own head.
- `iPCM/R11` — a method GIVEN an own `prototype` whose key is `function` → false — the one
  place tampering costs recall, and the narrowest possible such place.

## `isConciseAsyncMethod`

`isConciseAsyncMethod(value?: unknown): boolean` — `async` + mandatory trivia + key +
optional trivia + `(`, confirmed by `isAsyncFunction`.

**Admits**

- `iCAM/A1` — `({ async foo() {} }).foo` → true.
- `iCAM/A2` — `({ async async() {} }).async` → true — a method NAMED `async` carrying the
  modifier; the tag carries the async claim so the key is free to be `async`.
- `iCAM/A3` — `({ async asyncFoo() {} }).asyncFoo` → true.
- `iCAM/A4` — `async /* c */ foo() {}` → true — a single-line block comment is the only
  trivia legal after `async`.
- `iCAM/A5` — every non-identifier key form under the modifier → true.
- `iCAM/A6` — a cross-realm async method → true.

**Rejects**

- `iCAM/R1` — `({ asyncfoo() {} }).asyncfoo` → false — no separation, so this is a method
  NAMED `asyncfoo`. Trivia after `async` is one-or-more for exactly this reason.
- `iCAM/R2` — `async (a) => a` and `async x => x` → false — the key must be followed by
  `(`, and an arrow reaches `=>` instead. **This is deliberately NOT delegated** to
  `isAsyncArrowFunction` through a negation: consuming another predicate through `!` turns
  its false negatives into this one's false positives.
- `iCAM/R3` — `async function(){}` → false — **the undecidable pair; see below.**
- `iCAM/R4` — `async function foo(){}` → false — refused by keyword boundary.
- `iCAM/R5` — `async *foo(){}` → false — an async generator method.
- `iCAM/R6` — the plain, generator and async-generator flavors → false.
- `iCAM/R7` — bound, `Proxy`-wrapped and native values → false.

## `isConciseGeneratorMethod`

`isConciseGeneratorMethod(value?: unknown): boolean` — source starts with `*`, confirmed
by `isGeneratorFunction`. **The key is never read.**

A generator FUNCTION always opens with the `function` keyword and carries its `*` after
it, so within the `GeneratorFunction` tag a leading `*` belongs to a method and to nothing
else. Every key form and every spelling past the `*` is therefore admitted for free.

**Admits**

- `iCGenM/A1` — `({ *foo() {} }).foo` → true.
- `iCGenM/A2` — `*foo(){}`, `* foo() {}`, `*\nfoo() {}` → true — anything may follow the
  `*`, including a newline or a comment.
- `iCGenM/A3` — `({ *function(){} }).function` → true — `*function(){}` is unambiguous,
  since a generator function would put the `*` after the keyword.
- `iCGenM/A4` — every key form, private and computed included → true.
- `iCGenM/A5` — a generator method carrying an own `prototype` → true — **generator
  methods DO own one**, which is why `!hasOwnPrototype` can never be a shared
  entrance-level.
- `iCGenM/A6` — a cross-realm generator method → true.

**Rejects**

- `iCGenM/R1` — `function* () {}` and `function* named() {}` → false — the tag agrees, the
  leading `*` does not.
- `iCGenM/R2` — `async *foo(){}` → false — a different tag.
- `iCGenM/R3` — a bound generator method and a `Proxy`-wrapped one → false — **the tag
  alone would not do this.** Both KEEP `[object GeneratorFunction]` while stringifying to
  the anonymous native form; the leading `*` is what excludes them.

## `isConciseAsyncGeneratorMethod`

`isConciseAsyncGeneratorMethod(value?: unknown): boolean` — `async` + optional trivia +
`*`, confirmed by `isAsyncGeneratorFunction`. The key is not read here either.

Both this flavor and an async generator FUNCTION open with `async`, so the SECOND
significant token decides: `*` for a method, `function` for a function.

**Admits**

- `iCAGM/A1` — `({ async *foo() {} }).foo` → true.
- `iCAGM/A2` — `async*foo(){}` → true — the two may be adjacent, so trivia is zero-or-more
  here, unlike the async-to-key slot.
- `iCAGM/A3` — `async * foo() {}` and `async /* c */ *foo(){}` → true.
- `iCAGM/A4` — every key form → true.
- `iCAGM/A5` — a cross-realm async generator method → true.

**Rejects**

- `iCAGM/R1` — `async function* () {}` → false — `function` is the second token.
- `iCAGM/R2` — `*foo(){}` → false — no `async`.
- `iCAGM/R3` — bound and `Proxy`-wrapped async generator methods → false, by the same
  mechanism as `iCGenM/R3`.

## `isAnyConciseMethod` — the union

`isAnyConciseMethod(value?: unknown): boolean` — the disjunction of the four, never its
own pattern. A separate pattern must be kept in step with all four by hand and **drifted
twice** while this module was written: once matching inside a body, once refusing a
`*function(){}` that its own generator predicate accepted.

- `iAnyCM/A1` — every value admitted by any flavor → true.
- `iAnyCM/A2` — `({ async(){} }).async` → true — a plain method named `async`. **The
  regression vector.** Rewriting the async block from `if (isAsync) return false;` into a
  ternary else silently refused this shape: the statement form falls through to the plain
  block for a non-async value, the ternary form returns `false` for it. Same words,
  inverted reach.
- `iAnyCM/R1` — every value all four refuse → false.

### Standing laws (axis 1, asserted over the whole corpus)

- **L1 — union.** `isAnyConciseMethod(v)` equals the disjunction of the four flavors for
  every `v`. This law caught the `iAnyCM/A2` regression that the corpus nearly missed —
  only one row exercises that shape.
- **L2 — mutual exclusivity.** No value is admitted by more than one flavor.
- **L3 — precision, per #090.** Every failure of this module is a MISS. Across the entire
  hardening round no defect was ever a false positive, and preserving that asymmetry is a
  spec requirement, not a preference.
- **L4 — never throws**, including on `concise/X3`.
- **L5 — omitted-argument honesty.**

## Boundaries

Each is exotic — reachable by naming a member after a keyword, or by tampering after the
fact — and each is a case of silence.

### The undecidable pair — `async function(){}`

- `pair/U1` — `({ async function(){} }).function` and `(async function(){})` receive **the
  same verdict, `false`.**

A method's key is an IdentifierName, so a method may be NAMED `function`. As an async
method its source, tag, own-property set, prototype and `name` are all identical to an
anonymous async function expression's — `name` included, because NamedEvaluation names an
anonymous expression assigned to a property `function`. Nothing remains to read, so
neither is admitted. A test over this pair asserts they agree, so any future claim to have
resolved it must face the pair.

### The decidable counterpart — `function(){}`

- `pair/D1` — `({ function(){} }).function` → **true**, `(function(){})` → **false**.

The discriminator is `hasOwnPrototype`: a function expression is constructable and carries
one, a method does not. Kept beside the undecidable pair so the difference is visible
rather than asserted.

### Binding and wrapping

- `bnd/B1` — a bound method, a `Proxy`-wrapped method and `Function.prototype` → false, in
  every flavor. All stringify to the anonymous `[native code]` form, which carries no
  head.

### Tampering with `prototype`

- `bnd/B2` — a method GIVEN an own `prototype` is refused **only where the head is
  `function`** (`iPCM/R11`). `prototype` is `configurable: false` where it exists, so it
  can never be REMOVED from a function expression — which is what makes the decidable pair
  decidable — but it CAN be added to a method.

### The cost boundary

- `bnd/B3` — a method named `async` is the one input that pays a rejecting tag read (~30
  µs against ~0.3 µs). Its head is genuinely an async arrow's, so no source-reading
  separates them. **A property of the grammar, not a defect** — recorded so that measuring
  this input later does not read as a regression.

## Accessors

**Settled: the accessor ROLE is not modelled; the accessor SYNTAX is rejected.**

A getter or setter is a descriptor SLOT that accepts any callable — an arrow, a function,
a generator, a native, a bound function, even a class constructor (accepted at define
time, throwing only when read). These predicates take a value, never a descriptor, so the
role is unobservable. There is no accessor flavor and no fifth predicate.

- `acc/S1` — accessor SYNTAX is refused in every host and spelling: `get x(){}`,
  `set x(v){}`, in object literals and class bodies, static and instance, with computed,
  string, numeric and private keys → false. **This rejection is load-bearing**: an
  accessor has no own `prototype` and reports `[object Function]`, so only the source
  pattern excludes it. Every accessor carries a PropertyName between the keyword and the
  `(`, which is what separates it from a method NAMED `get` (`get(){}` — admitted,
  `iPCM/A3`).
- `acc/S2` — accessors can be neither `async` nor generators; those spellings are
  SyntaxErrors and need no vector.
- `acc/L1` — a callable installed INTO an accessor slot keeps its own classification. A
  concise method passed to `defineProperty` as a getter IS a plain concise method, and is
  reported as one. The twelve slot vectors are each classified on their own merits, not on
  the role they were installed into.

## Grammar bounds — the illegal headers

The trivia rules are **position-dependent**, which is why one class will not do:

| slot                                      | newline | line comment | multi-line block comment |
| ----------------------------------------- | ------- | ------------ | ------------------------ |
| after `async`                             | ✗       | ✗            | ✗                        |
| after `*` · after `get`/`set` · key → `(` | ✓       | ✓            | ✓                        |

Every illegal header is a LineTerminator in the slot after `async`. The absence of entries
for the other slots is the point.

- `concise/G1` — `({ async\nfoo() {} }).foo` → SyntaxError.
- `concise/G2` — `({ async\n*foo() {} }).foo` → SyntaxError.
- `concise/G3` — `({ async // c\n foo() {} }).foo` → SyntaxError.

Comment interiors are matched unrolled (`(?:[^*]|\*(?!\/))*`), never lazily: a lazy
quantifier still expands across a later comment terminator and would swallow the code
between two comments, matching a header that is not one.

## Helper specification (axis 4)

Each helper reports whether a source OPENS with a shape. **None is a verdict.** Two of the
names still assert their conclusion rather than their observation — noted so the gap is
visible rather than discovered.

### `matchesLeadingAsyncToken(source: string): boolean` — `@internal`

- `mLAT/A1` — `'async foo(){}'`, `'async(){}'`, `'async (x) => x'`, `'async => async'` →
  true. The TOKEN, not the modifier: a key or an arrow parameter of that name matches too.
  The name was corrected to say only this after an earlier one claimed async-ness the
  regex cannot establish — and that mis-modelling is what made the ternary regression look
  sound.
- `mLAT/R1` — `'asyncFoo(){}'` → false — a key merely beginning with those letters.

### `matchesStartSequencesOfConciseAsyncGeneratorMethodSource(source: string): boolean` — `@internal`

- `mCAGM/A1` — `'async *foo(){}'`, `'async*foo(){}'`, `'async /* c */ *f(){}'` → true.
- `mCAGM/R1` — `'async function* (){}'` → false.

### `matchesStartSequencesOfConciseAsyncMethodSource(source: string): boolean` — `@internal`

- `mCAM/A1` — `'async foo(){}'`, `'async async(){}'` → true.
- `mCAM/R1` — `'asyncfoo(){}'` → false — separation is mandatory.
- `mCAM/R2` — `'async function(){}'` → false — excluded by keyword boundary.
- `mCAM/R3` — `'async x => x'` → false — `(` must follow the key.

### `matchesStartSequencesOfConciseMethodNormalForm(source: string): boolean` — `@internal`

- `mCMNF/A1` — every key form followed by `(` → true.
- `mCMNF/A2` — `'function(){}'` and `'async(x) => x'` → **true** — necessary but not
  sufficient. An anonymous function expression and a parenthesized async arrow share this
  shape and are settled by further reads. The name asserts more than the pattern sees.
- `mCMNF/R1` — `'get x(){}'` → false — an accessor's PropertyName intervenes.

### `matchesStartSequencesOfUnnamedPlainFunctionSource(source: string): boolean` — `@internal`

- `mUPFS/A1` — `'function(){}'`, `'function (){}'` → true — and a method NAMED `function`
  wears this head identically, which is the whole reason the caller reads
  `hasOwnPrototype` next.
- `mUPFS/R1` — `'function foo(){}'` → false.

## Throw-safety (axis 5) — completeness oracle

Ten exports carry `@@throw-safe`, in both files of the pair — the five predicates and the
five helpers listed in the surface inventory. The axis-5 suite asserts the triple-lock:
markers found in source ⟺ the set declared in `test/concise/__config.js` ⟺ the set
actually exercised. Hostile values are fed **by declared parameter type**: `unknown` for
the five predicates (unrestricted, including `concise/X3`); `string` for the five helpers.

## Resolved items

1. **`iPCM/R10` was wrong when first written (caught by the decidability run,
   2026-08-11).** It claimed a method whose body contains another method's text is
   refused. The predicate admits it — correctly, since only the head is read — so the SPEC
   was the defect, not the code. Rewritten to use a non-method host, with the admission
   split out as `iPCM/A9` so both directions of "the head decides" are pinned. Recorded
   because it is the exact value a decidability run exists to produce: the one place
   reasoning and behavior diverged, in a spec whose other 140-odd vectors held.
2. **`isConciseGenericMethod` → `isPlainConciseMethod` (2026-08-11).** The flavor-less
   form is the only one of the four with **no name in ECMA-262** — `GeneratorMethod`,
   `AsyncMethod` and `AsyncGeneratorMethod` are named productions, while the plain form is
   just the first alternative of `MethodDefinition`. MDN mirrors this exactly: headings
   for the other three, none for this one, and the word "generic" never appears. So no
   established term had been mis-borrowed — the name was ours to coin, and "generic" was
   the poor coin. It means **a method with type parameters** in TypeScript, Java and C#,
   and multiple dispatch in CLOS, which is a live misreading in a package whose `.d.ts` is
   the consumer surface. Both documents had already voted: `concise.d.ts` and this spec
   described the predicate as "carrying no modifier" and "the unmodified method", and
   neither ever explained "generic". `isConciseMethod` was considered and rejected — it
   sits one word from `isAnyConciseMethod`, and that word carries the entire distinction
   between one flavor and all four. Executed before any test suite existed, which was the
   cheapest moment it would ever be.

   **The same rename was carried to the helper**:
   `matchesStartSequencesOfUnnamedGenericFunctionSource` →
   `matchesStartSequencesOfUnnamedPlainFunctionSource`, vector prefix `mUGFS/` → `mUPFS/`.
   It describes a function EXPRESSION rather than the method flavor, so it was a separate
   call — but leaving `Generic` as the module's only remaining use of the word would have
   recreated the drift the rename removed. The word now appears nowhere in the module's
   vocabulary except these historical notes.

3. **"Two helper names assert their conclusions" — RAISED AND CLOSED, 2026-08-11 (owner
   ruling).** The concern was that `…OfUnnamedPlainFunctionSource` and `…NormalForm` name
   something the pattern cannot establish, the way `matchesStartSequenceOfAnyAsyncSource`
   once did before becoming `matchesLeadingAsyncToken`. **They are not the same failure
   class, and treating them as one was the error.**

   That earlier name asserted a property of the VALUE — async-ness — which no regex over
   source can reach, and the mis-modelling it invited produced a real regression
   (`iAnyCM/A2`). These two name a SOURCE FORM after its canonical producer, which is
   exactly what they match. A second construct emitting the same bytes makes the TEXT
   ambiguous; it does not make the NAME false. `function(){}` is the source of an unnamed
   plain function; that a method named `function` emits the identical text is a fact about
   JavaScript, documented as an edge case at `mUPFS/A1`, `pair/U1` and `pair/D1`.

   The guard against the misreading a maintainer could still make — "this matched, so it
   IS an unnamed plain function, drop the `hasOwnPrototype` read" — belongs at the call
   site, and it is already there in both dialects. `concise.js` says the coincidence "is
   the point: the helper marks the one head where the source has said all it can";
   `concise.d.ts` says a method named `function` "wears identically"; `…NormalForm` opens
   with "NECESSARY but not sufficient" and enumerates all three coincident shapes. Nothing
   is lost by closing, because nothing was being carried here that the canon does not
   carry better.

## Open items

1. **No `./concise` subpath is published**, pending the package-wide subpath decision.

The helper-naming item that stood here was raised and closed the same day; git carries its
text, and Resolved item 3 carries the reasoning.
