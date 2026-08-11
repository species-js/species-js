# function-introspection / concise

## Mental model

A shorthand method definition leaves no structural trace. `[[HomeObject]]` — the slot only
a method carries — cannot be observed, so a method and the function it resembles are
indistinguishable by shape alone.

The answer comes from `[[SourceText]]`, combined with two signals a caller cannot forge:
the spec-defined tag, and the presence of an own `prototype`. The head is a key,
optionally behind `async`, `*`, or both, followed by the parameter list. Four flavors, one
union.

## Each flavor reads as little of the head as it can

The four predicates are not variations of one pattern. Each stops reading at the earliest
token that decides, and how early that is differs sharply.

- **Generator** reads one character. A generator _function_ always opens with the
  `function` keyword and carries its `*` after it, so within the `GeneratorFunction` tag a
  leading `*` belongs to a method and to nothing else. **The key is never read**, which is
  why every key form and every spelling past the `*` is admitted for free.
- **Async generator** reads two significant tokens. Both this flavor and an async
  generator function open with `async`, so the second token decides: `*` for a method,
  `function` for a function.
- **Async** must read the key, because the head is `async` + key + `(`. Separation after
  `async` is mandatory — `asyncfoo()` is a method _named_ `asyncfoo`.
- **Plain** reads the key and then, for one head only, reads further.

That gradient has a consequence worth stating, because it looks like luck: **the less of
the head a predicate reads, the more comment spellings it tolerates for free.** When the
two generator flavors stopped reading past their modifier, parked header-comment cases
resolved themselves without any comment handling being written.

## Gate scoping

`!hasOwnPrototype` and the native-source subtraction apply to a **`function` head alone**,
not to every key.

The reason is a survey, not a preference. Of everything carrying an own `prototype`, only
the anonymous function expression reaches the plain pattern at all — named function
expressions, generator functions, generator and async-generator methods and class
constructors are already refused by the pattern. So the gate was load-bearing for exactly
one shape while taxing every other key, and applying it universally cost recall on methods
that had merely been _given_ a `prototype`.

This also reconciles an apparent contradiction with `arrow`, where the same gate was
dropped entirely. There it was decorative: the head-scan already refused everything it
would have excluded. The transferable rule is neither "gates good" nor "gates bad" —
**measure what a gate uniquely excludes before applying it broadly.**

## Two collisions with a function expression, one decidable

A method's key is an IdentifierName, so reserved words are legal there. A method may be
named `function`, and then its source _is_ a function expression's.

- **Plain — decidable.** `({ function(){} }).function` and `(function(){})` stringify
  identically, but a function expression is constructable and so carries an own
  `prototype`. The method does not. That read is the discriminator, and it is the reason
  the gate above exists at all.
- **Async — undecidable, and refused.** As an async method the two agree on source, tag,
  own-property set, prototype **and** `name` — NamedEvaluation gives an anonymous async
  expression assigned to a property named `function` exactly that name. Nothing remains to
  read, so neither is admitted.

The pair sits at the center of this module's honesty claim. Refusing the undecidable case
is what makes every admission the module _does_ make a proof, and it is why the exports
may take the `is…` prefix at all (#090).

## Accessors: a role, not a kind

A getter or setter is a **descriptor slot**, and the slot accepts any callable — an arrow,
a function expression, a generator, a native, even a class constructor. So "getter" names
where a function was installed, never what the function is. These predicates receive a
value and never a descriptor, so the role is unobservable and deliberately unmodelled.
There is no accessor flavor and no fifth predicate.

The two halves of that ruling pull in opposite directions, and both are load-bearing:

- **Accessor syntax is always rejected.** A function created by `get x() {}` has no own
  `prototype` and reports `[object Function]`, so neither the gate nor the tag excludes it
  — **only the source pattern does.** Every accessor carries a PropertyName between the
  keyword and the `(`, which is exactly what separates it from a method named `get`.
- **A method installed into a slot keeps its flavor.** `{ get() { … } }` passed to
  `defineProperty` _is_ a plain concise method that happens to be a getter.

## The key class, and the one input that costs

A key may be an identifier, private, numeric, quoted or computed — and it may begin with a
digit, where an arrow's parameter may not. The two modules therefore cannot share one
class. The numeric branch is separate for that reason, and it covers every legal literal
form; an earlier class silently refused three of them.

**A method named `async` is the one input that pays a rejecting tag read**, roughly two
orders of magnitude above any other. Its head is also a parenthesized async arrow's, and
no amount of source-reading separates them. That is a property of the grammar, not a
defect to optimize away — recorded so that measuring this input later does not read as a
regression.

## The union is derived, never patterned

`isAnyConciseMethod` is the disjunction of the four. A separate pattern would have to be
kept in step with all four by hand, and the union law then holds only by vigilance.
Derived, it holds by construction and inherits the four boundaries exactly.

## Open architectural questions

**No `./concise` subpath is published**, pending the package-wide subpath decision.

**The generator flavor's tag read may be unfalsifiable.** Every constructible value whose
source starts with `*` is a `GeneratorFunction`, so the source check appears to decide
alone. The tag confirmation is kept as defense-in-depth, but nothing demonstrates it
changes an answer, and no contrived vector was invented to pretend otherwise.
