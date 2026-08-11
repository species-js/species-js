# arrow — behavioral specification

> Spec format and the multi-axis model are defined in
> [type-detection's spec README](../../../type-detection/docs/spec/README.md); this
> package follows the same model and does not restate it. Vectors are reasoned from the
> canon (`arrow.js`, `arrow.d.ts`, decisions #087, #088 and #090). Status: **FROZEN
> 2026-08-11** — decidability check passed: every vector below was executed against the
> real predicates through the `#index` barrel before freezing, including the cross-realm
> values (`node:vm`), the two helper contracts, and the four illegal headers asserted to
> be `SyntaxError`. This spec is the base for the axis-1 suite; axes 2–5 derive alongside.

## Module contract

`function-introspection / arrow` answers one question: **is this value an arrow function,
and if so which flavor?**

Nothing structural separates an arrow from the concise method it resembles. Both lack an
own `prototype` and a `[[Construct]]` slot, both report `[object Function]`, and both name
`Function` as their constructor. `[[HomeObject]]`, which only a method carries, has no
observable channel. What remains is `[[SourceText]]`, read through the realm-fixed
`Function.prototype.toString`.

```
entrance-level:  isFunction(value)
      │
      ├── source head matches `(` | ident =>          → isArrowFunction
      ├── source head matches `async` … then isAsyncFunction
      │                                                → isAsyncArrowFunction
      └── either of the two                            → isAnyArrowFunction
```

**Only the source HEAD is read, never the body.** A method whose body contains an arrow is
classified by its own head. An arrow's head is a parameter list followed by `=>`,
optionally behind an `async` modifier. A property key can never be parenthesized, so a
leading `(` settles the question alone. The parameter list is never scanned, which is why
no lexer, no balanced-paren counting and no regex-literal handling exist here.

**The one shape source cannot decide is `async(`**, which opens both an async arrow's
parameter list and a concise method NAMED `async`. `isAsyncFunction` settles it — the
arrow is an async function, the method is not. This is the #090 criterion in action: the
ambiguity is removed by a signal no caller controls, never guessed.

These predicates are named `is…` under **#090**. Admission rests only on `[[SourceText]]`
read through a realm-fixed intrinsic and on the spec-defined async tag. Every boundary
below is a MISS rather than a wrong answer. Neither predicate ever invokes the value.

### Reading order (white-box, load-bearing)

Both predicates test the source shape before they consult the async tag. Tag predicates
are cheap when they SUCCEED and roughly two orders of magnitude dearer when they REJECT.

`isFunction` is the exception and belongs in front. It is the floor-level `typeof` test,
priced the same either way, and it keeps `getFunctionSource` from absorbing a `TypeError`.
See `UTILITY.spec.md` → `gCFS/A4`.

This is white-box and does not change a single verdict. It is specified because reversing
it is invisible in tests and expensive in production.

**Measured 2026-08-11.** `isAsyncArrowFunction` reading the source ahead of the tag,
against the same predicate with the tag first: **41–56× faster on a concise method and on
a native**, unchanged on every other workload.

Dropping the `isFunction` guard is the mirror case. It saves 0.1–0.3 µs on a callable and
costs ~9 µs on every non-callable, the omitted argument included.

**`isAnyArrowFunction`'s operand order was load-bearing until that rewrite.** While
`isAsyncArrowFunction` still opened with `isAsyncFunction`, testing the async flavor first
cost roughly **100× on a plain arrow — 43.8 µs against 0.40**.

Source-first removed the dependency. Both operands now refuse on the source shape before
either reaches a flavor tag, so neither pays a rejecting read on the other's values. A
mutation probe confirms it: swapping the operands changes no verdict and the suite passes
unchanged. Sync stays first as the commoner flavor.

## Surface inventory

| Export                                            | Visibility  | `@@throw-safe` |
| ------------------------------------------------- | ----------- | -------------- |
| `isArrowFunction`                                 | public      | yes            |
| `isAsyncArrowFunction`                            | public      | yes            |
| `isAnyArrowFunction`                              | public      | yes            |
| `matchesStartSequencesOfArrowFunctionSource`      | `@internal` | yes            |
| `matchesStartSequencesOfAsyncArrowFunctionSource` | `@internal` | yes            |

No `./arrow` subpath is published, on #088's ground that one module of three predicates is
not a consumer-facing claim of coherence.

## Cross-cutting vectors — the entrance-level

Applies to all three predicates identically.

- `arrow/X1` — `undefined`, `null`, `42`, `'x'`, `{}`, `[]`, `Symbol()`, `0n`, `true` →
  false — not callable. A string that spells an arrow (`'x => x'`) is included
  deliberately: the predicate classifies values, never text.
- `arrow/X2` — an omitted call `f()` → false — `undefined` is outside the accept set, so
  no `arguments.length` gate is needed (#079 honest-by-construction).
- `arrow/X3` — a hostile callable (revoked `Proxy`, throwing `get` trap, throwing
  `getOwnPropertyDescriptor` trap, null-prototype callable) → false, never a throw.
- `arrow/X4` — a value whose source cannot be read yields `''` and is refused by the
  pattern; no predicate distinguishes "unreadable" from "not an arrow".

## `isArrowFunction`

`isArrowFunction(value?: unknown): boolean` — entrance-level, then the non-async head
pattern: a leading `(`, or a bare parameter followed by `=>`.

**Admits**

- `iAF/A1` — `(a) => a` → true — parenthesized list.
- `iAF/A2` — `a => a` → true — bare parameter.
- `iAF/A3` — `() => 0` → true — empty list.
- `iAF/A4` — `$ => $`, `_ => _` → true — `$` and `_` are `ID_Start`.
- `iAF/A5` — `x=>x` → true — fully tight spelling.
- `iAF/A6` — `({ a = 1 }, ...rest) => [a, rest]` → true — destructuring, defaults and rest
  are inside the parameter list, which is never scanned.
- `iAF/A7` — `async => async` → true — **a parameter NAMED `async`, not the modifier.**
  The bare-parameter branch admits it because `=>` follows the identifier. This is the
  vector a `(?!async\s*)` lookahead broke.
- `iAF/A8` — a cross-realm arrow (`node:vm`) → true — no realm-fixed identity is
  consulted.

**Identifier spellings** — the class is `ID_Start`/`ID_Continue`, not a hand-rolled letter
class, because each of these is a legal parameter name that a narrower class silently
refused:

- `iAF/A9` — `ä => ä` → true — non-ASCII letter.
- `iAF/A10` — a parameter containing ZWNJ (U+200C) → true.
- `iAF/A11` — a parameter containing ZWJ (U+200D) → true.
- `iAF/A12` — a parameter with a combining mark (`\p{Mn}`) → true.
- `iAF/A13` — a Devanagari parameter → true.
- `iAF/A14` — a parameter spelled with a unicode escape (`a => a`) → true — `toString`
  reports the escape text verbatim, so the pattern must accept it.

**Header comments** — a comment may sit between the parameter list and `=>` and inside the
parameter list. Only single-line block comments can occur there; see Grammar bounds.

- `iAF/A15` — `(a) /* c */ => a` → true.
- `iAF/A16` — `a /* c */ => a` → true.
- `iAF/A17` — `( /* c */ ) => 0` → true — comment inside an empty list.
- `iAF/A18` — `a /* c1 */ /* c2 */ => a` → true — two consecutive comments.
- `iAF/A19` — a comment whose interior holds a lone `*` or `/` → true — the unrolled
  interior `(?:[^*]|\*(?!\/))*` handles both.

**Rejects**

- `iAF/R1` — `async (a) => a`, `async x => x`, `async(x)=>x` → false — the async flavor,
  refused by the pattern rather than by a gate: `=>` does not follow the identifier
  `async`.
- `iAF/R2` — `({ m() {} }).m` → false — a concise method; the first identifier is followed
  by `(`, not `=>`.
- `iAF/R3` — `({ get x() {} })`'s getter and the matching setter → false — an accessor
  puts a PropertyName between the keyword and `(`.
- `iAF/R4` — every other concise flavor: `async m(){}`, `*m(){}`, `async *m(){}` → false.
- `iAF/R5` — a member named `async` in each host that can declare one — object literal
  method, class prototype method, class static method, getter, setter → false.
- `iAF/R6` — `function f() {}`, `function () {}`, `function* () {}`,
  `async function () {}`, `new Function('a', 'return a')` → false — the classic forms.
- `iAF/R7` — `class C {}` and a class constructor → false.
- `iAF/R8` — `Math.max` and other natives → false — the `[native code]` form carries no
  head.
- `iAF/R9` — `((a) => a).bind(null)` → false — **documented boundary.** Binding
  stringifies to the anonymous native form; nothing source-based can recover the original.
- `iAF/R10` — a `Proxy` wrapping an arrow → false — same boundary, same mechanism.
- `iAF/R11` — `Function.prototype` → false — no head at all.
- `iAF/R12` — a method whose BODY contains an arrow, e.g.
  `({ m() { return (x) => x; } }).m` → false — **the anchoring vector.** An unanchored
  alternation once matched these, producing 19 false positives.
- `iAF/R13` — `({ m /* c */ (a) { const f = x /* d */ => 1; return f; } }).m` → false —
  **the backtracking vector.** A lazily-quantified comment interior (`[\s\S]*?`) expands
  across the later `*/` and swallows the code between the two comments, matching this
  method as an arrow.
- `iAF/R14` — a cross-realm concise method → false.

## `isAsyncArrowFunction`

`isAsyncArrowFunction(value?: unknown): boolean` — entrance-level, then the async head
pattern, then `isAsyncFunction`.

**Admits**

- `iAAF/A1` — `async (a) => a` → true.
- `iAAF/A2` — `async x => x` → true — bare parameter; trivia after `async` is mandatory
  here, since `asyncx` would read as one identifier.
- `iAAF/A3` — `async(x) => x` → true — no space needed before a parenthesized list.
- `iAAF/A4` — `async(x)=>x` → true — fully tight.
- `iAAF/A5` — `async () => 0` → true — empty list.
- `iAAF/A6` — `async /* c */ (x) => x` → true — single-line block comment after `async`.
- `iAAF/A7` — the identifier spellings of `iAF/A9`–`A14`, as async arrows → true.
- `iAAF/A8` — a cross-realm async arrow → true.

**Rejects**

- `iAAF/R1` — `(a) => a` and every sync arrow → false — no `async` token.
- `iAAF/R2` — `async => async` → false — a parameter named `async`; the value is not an
  async function, so the tag refuses it even though the token matches.
- `iAAF/R3` — `({ async() {} }).async` → false — **the collision.** Its head is
  `async(){}`, identical to a parenthesized async arrow's opening; only `isAsyncFunction`
  separates them, and a method is `[object Function]`.
- `iAAF/R4` — `({ async async() {} }).async` → false — an async method NAMED `async`. The
  tag now agrees, and the pattern is what refuses: `=>` never follows.
- `iAAF/R5` — `async function () {}` → false — after `async` comes `function`, so neither
  branch matches.
- `iAAF/R6` — `async *m(){}` (async generator method) and `async function* () {}` → false.
- `iAAF/R7` — `(async (a) => a).bind(null)` → false — bound, so hidden.
- `iAAF/R8` — a `Proxy` wrapping an async arrow → false.
- `iAAF/R9` — an async method whose body contains an async arrow → false — head only.

## `isAnyArrowFunction` — the union

`isAnyArrowFunction(value?: unknown): boolean` — exactly
`isArrowFunction(value) || isAsyncArrowFunction(value)`, derived rather than given a
pattern of its own. An independent pattern is what repeatedly reintroduced the `async(`
collision; deriving it makes the tag confirmation apply to both arms for free.

- `iAnyAF/A1` — every value admitted by either flavor → true.
- `iAnyAF/R1` — every value both refuse → false.

### Standing laws (axis 1, asserted over the whole corpus)

- **L1 — union.**
  `isAnyArrowFunction(v) === (isArrowFunction(v) || isAsyncArrowFunction(v))` for every
  `v`. Cheap, and stronger than any vector: the equivalent law in `concise` caught a
  regression the corpus nearly missed.
- **L2 — mutual exclusivity.** `isArrowFunction(v) && isAsyncArrowFunction(v)` is never
  true.
- **L3 — precision, per #090.** No value outside the arrow set is ever admitted. Every
  known failure of this module is a MISS. A vector that admits a non-arrow is a spec
  violation, not a tuning question.
- **L4 — never throws.** Every predicate answers a boolean on every input, including the
  hostile callables of `arrow/X3`.
- **L5 — omitted-argument honesty.** `p()` equals `p(undefined)` equals `false`.

## Grammar bounds — the illegal headers

These pin the bound the trivia pattern is built on, and are asserted to be `SyntaxError`
rather than assumed. **A LineTerminator may precede neither `=>` nor an async arrow's
parameters**, which makes every line comment and every newline-bearing block comment
illegal in those slots — so only single-line block comments can occur.

- `arrow/G1` — `a // c\n => a` → SyntaxError.
- `arrow/G2` — `async // c\n (x) => x` → SyntaxError.
- `arrow/G3` — `a /* \n */ => a` → SyntaxError.
- `arrow/G4` — `async /* \n */ (x) => x` → SyntaxError.

**Consequence — the `//` branch in the trivia group is unreachable in this module.** It is
kept deliberately, for symmetry with `concise`, whose key-to-parenthesis slot genuinely
admits a line comment. Trip condition: if `concise`'s key slot ever stops admitting one,
delete the branch in both.

## Helper specification (axis 4)

Both helpers take a source string and report whether it OPENS with a head shape. Neither
is a verdict on its own; the module doc names what each one actually sees.

### `matchesStartSequencesOfArrowFunctionSource(source: string): boolean` — `@internal`

- `mSSAFS/A1` — `'(a) => a'`, `'a => a'`, `'x=>x'` → true.
- `mSSAFS/A2` — `'async => async'` → true — the bare-parameter branch, `=>` following.
- `mSSAFS/R1` — `'m() {}'`, `'get x() {}'` → false — something other than `=>` follows the
  first identifier.
- `mSSAFS/R2` — `'async (a) => a'` → false — `=>` does not follow the identifier `async`.
- `mSSAFS/X1` — `''` → false — the unreadable-source case.

### `matchesStartSequencesOfAsyncArrowFunctionSource(source: string): boolean` — `@internal`

Trivia before a parenthesized list is zero-or-more (`async(x)=>x` is legal); before a bare
parameter it is one-or-more.

- `mSSAAFS/A1` — `'async (x) => x'`, `'async(x)=>x'`, `'async x => x'` → true.
- `mSSAAFS/A2` — `'async(){}'` → **true** — and this is the point: matching is not a
  verdict. A concise method named `async` wears the same head, which is why the caller
  confirms with `isAsyncFunction`.
- `mSSAAFS/R1` — `'async function () {}'` → false — `function` follows.
- `mSSAAFS/R2` — `'async *m(){}'` → false — `*` follows.
- `mSSAAFS/R3` — `'asyncx => x'` → false — one identifier, not the modifier.
- `mSSAAFS/X1` — `''` → false.

## Throw-safety (axis 5) — completeness oracle

Five exports carry `@@throw-safe`, in both files of the pair:

| export                                            | `.js` | `.d.ts` |
| ------------------------------------------------- | ----- | ------- |
| `isArrowFunction`                                 | ✓     | ✓       |
| `isAsyncArrowFunction`                            | ✓     | ✓       |
| `isAnyArrowFunction`                              | ✓     | ✓       |
| `matchesStartSequencesOfArrowFunctionSource`      | ✓     | ✓       |
| `matchesStartSequencesOfAsyncArrowFunctionSource` | ✓     | ✓       |

The axis-5 suite asserts the triple-lock: markers found in source ⟺ the set declared in
`test/arrow/__config.js` ⟺ the set actually exercised. Hostile values are fed **by
declared parameter type**: `unknown` for the three predicates (unrestricted, including the
`arrow/X3` callables); `string` for the two helpers (`''`, whitespace, punctuation soup, a
lone surrogate, combining marks, a 1 MB string, embedded NUL, an RTL override, emoji).

## Open items

1. **No `./arrow` subpath is published.** Whether this package publishes subpaths at all
   is still undecided; the module is reachable through the barrel either way.
