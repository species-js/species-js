# 048 — `resolveType` lowercase-name precedence as conflict-resolution refinement

**Date:** 2026-06-13

**Context.** The 2026-06-09 refactor of `getDefinedConstructor` to inert pivot-and-walk
(#047) made the constructor name read tamper-resistant. `resolveType`'s audit-era defenses
— the descriptor walk on `constructor` and the `isFunction(constructor)` guard against
`{ constructor: 'tampered' }` style overrides — became dead code, since the underlying
walk now refuses to surface a non-function result at all.

The mechanical simplification also surfaced a separate question that the old single-axis
dispatch ("name reachable → name, else tag") had conflated. With the defenses stripped,
five input classes emerge as distinct:

| Input                        | Old result | Insight                                                    |
| ---------------------------- | ---------- | ---------------------------------------------------------- |
| `null`, `undefined`          | tag        | Tag is the canonical answer; name is genuinely absent.     |
| `Object.create(null)`        | `'Object'` | Same — no reachable constructor; tag is the only signal.   |
| `new (function () {})()`     | `''`       | Anonymous instance; empty name leaks; tag would be honest. |
| `new (function foo () {})()` | `'foo'`    | Lowercase user function; name carries more info than tag.  |
| Tag-spoofed plain object     | `'Object'` | Name beats tag spoofing (preserved by #047).               |

After #047, the lowercase user-function case becomes live: the constructor name is now
reliably retrieved without invoking overrides, so a lowercase user constructor reaches
`resolveType` cleanly and the question "do we prefer `'foo'` or `'Object'`?" must be
answered as policy rather than left as accident.

**Decision.** Restructure `resolveType` as a two-tier guard-clause dispatch with a
module-local hoisted regex:

```js
const startsWithUpperCase = /^\p{Lu}/u;

export function resolveType(...args) {
  const value = args[0];
  if (args.length === 0) return undefined;

  const name = getDefinedConstructorName(value);
  if (name && startsWithUpperCase.test(name)) return name;

  const type = getTaggedType(value);
  return type === 'Object' && name ? name : type;
}
```

Two axes:

1. **PascalCase-leading name wins outright.** A Unicode uppercase-leading constructor name
   (`\p{Lu}`) is the canonical type identifier for every built-in and every well-written
   user class. When present, it carries the most precise type information available; the
   tag is not consulted.

2. **Non-empty lowercase name beats the uninformative `'Object'` tag.** A lowercase name
   (e.g., `'foo'` from `function foo () {}`) is more informative than the structural
   `'Object'` tag, which by itself says only "this is an object." In every other conflict
   the tag wins — including the anonymous-empty-name case (`name === ''`), where the empty
   string carries no information.

The Unicode-class regex admits non-Latin uppercase openers (Cyrillic, Greek, etc.) —
anything ECMA-262's `\p{Lu}` recognizes counts. The regex is hoisted to module scope above
the function to avoid per-call compilation.

**Rationale.** Four forces converge:

- **Inertness propagates the simplification.** #047 made the constructor name reliable.
  The defensive descriptor-walk and `isFunction` check were redundant; their removal is
  mechanical, not semantic. The freed surface area exposed the real policy choice.

- **The empty-name vs. lowercase-name distinction is real.** A `function foo () {}` is
  intentionally named by a developer; an empty name is the runtime saying "this function
  carries no developer-supplied identity." Treating both as "weak" loses signal. The new
  rule honors the distinction.

- **`'Object'` is the uninformative tag.** Every plain `[[Class]]` lands on `'Object'`; it
  carries no type information beyond "this is a structural object." When a competing
  source (a non-empty lowercase name) carries more, it should win that specific conflict —
  and only that conflict. The tag's other values (`'Null'`, `'Undefined'`, `'Arguments'`,
  `'Date'`, `'RegExp'`, etc.) DO carry information and are not displaced.

- **Spoof resistance is preserved.** A `Symbol.toStringTag` override on a value with a
  PascalCase constructor name (the common spoofing surface) does not reach the tag branch
  — the name short-circuits at the first guard. Combined with #047's tamper-resistant name
  read, the function's output is uniformly grounded in the structural type rather than in
  user-supplied overrides.

**Consequences.** The function's behavior changes on two input classes; standard cases
(every PascalCase-named built-in, every PascalCase user class) are unaffected.

| Input                        | Old        | New        |
| ---------------------------- | ---------- | ---------- |
| `null`                       | `'Null'`   | `'Null'`   |
| `[]`                         | `'Array'`  | `'Array'`  |
| `{}`                         | `'Object'` | `'Object'` |
| `Object.create(null)`        | `'Object'` | `'Object'` |
| `new (function () {})()`     | `''`       | `'Object'` |
| `new (function foo () {})()` | `'foo'`    | `'foo'`    |

The `ResolvedType` union is not narrowed at the type level — other producers in the module
may still emit `''` — but `resolveType` itself no longer surfaces it.

Commit `d0c470d`. See
[`../architecture/utility.md`](../architecture/utility.md#type-resolution) — "Type
Resolution" for the two-axis dispatch walk-through and the spoof-resistance composition
with #047.
