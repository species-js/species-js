# function-introspection / arrow

## Mental model

An arrow function and a concise method are structurally indistinguishable. Both lack an
own `prototype` and a `[[Construct]]` slot. Both report `[object Function]`. Both name
`Function` as their constructor. The one slot that differs, `[[HomeObject]]`, has no
observable channel.

That leaves `[[SourceText]]`, and it is enough — because an arrow's head is a shape no
property key can wear.

## The head decides, and it decides on the first token

An arrow's head is a parameter list followed by `=>`, optionally behind `async`. A
property key can never be parenthesized, so **a leading `(` settles the question by
itself**. The parameter list is never scanned.

That single observation is why this module contains no lexer, no balanced-paren counting
and no regex-literal handling. An early implementation built all three and was reverted.
The bare-parameter branch is what refuses a concise method (`m() {}`) and an accessor
(`get x() {}`): both put something other than `=>` after the first identifier.

Only the head is read, never the body. A method that returns an arrow is classified by its
own head — the anchoring that a corpus of body-contains-an-arrow vectors exists to
protect.

## The one collision source cannot decide

`async(` opens an async arrow's parameter list. It also opens a concise method **named**
`async`. Nothing in the source separates them.

`isAsyncFunction` does: the arrow carries `[object AsyncFunction]`, the method does not.
This is the #090 criterion in its clearest form — where a shape could belong to two kinds,
a signal no caller controls settles it, and the predicate does not guess from the likelier
reading.

The inverse case is subtler and cost this module a defect. `async => async` is a **sync**
arrow whose single parameter happens to be called `async`. A lookahead added to exclude
the async modifier rejected it, because a lookahead cannot tell a modifier from a
parameter name. The alternation already excluded the real async arrow — a genuine one
fails the bare-parameter branch on its own, since `(` or an identifier follows the word,
never `=>`.

## Reading order

Both predicates match the source before consulting the async tag, and `isFunction` runs
ahead of everything. The package-level rationale is in [the index](./README.md); what is
specific here is which values pay.

The expensive rejection is the **prototype-less callable** — a concise method, a native, a
bound function — which is precisely what an arrow check tends to be handed. A method named
`async` is the one value that still pays a rejecting tag read, because its head genuinely
is an async arrow's.

The union is a **disjunction of the two flavors, never a pattern of its own.** Giving it
an independent pattern is what repeatedly reintroduced the `async(` collision; deriving it
makes the tag confirmation apply to both arms for free. Its operand order is now free,
because neither operand reaches a tag before the source refuses.

## Trivia, and what a parameter may be called

A comment may sit inside the parameter list, before `=>`, and after `async`. A
LineTerminator may not. That makes every line comment and every newline-bearing block
comment a SyntaxError in those slots, so only single-line block comments occur.

The `//` branch in the trivia group is therefore unreachable here. It is kept for symmetry
with `concise`, whose key-to-parenthesis slot genuinely admits one — a decision with a
live trip condition, since a `concise` corpus row asserts exactly that condition.

Comment interiors match **unrolled**, never lazily. A lazy quantifier still expands past a
later terminator, and would swallow the code between two comments — which once matched a
plain concise method as an arrow.

A bare parameter matches `ID_Start` / `ID_Continue` rather than a hand-rolled letter
class. An identifier may legally carry combining marks and zero-width joiners, and may be
written with unicode escapes that `toString` reports verbatim. Note the asymmetry with
`concise`: a key may begin with a digit where a parameter may not, so the two modules
cannot share one class.

## Open architectural questions

**No `./arrow` subpath is published**, on #088's ground that one module of three
predicates is not a consumer-facing claim of coherence. `./bound` exists, which makes the
package's subpath surface asymmetric.

**Whether the unreachable `//` branch should survive a second review.** It costs nothing
and buys symmetry, but it is dead code kept deliberately, and that is the kind of decision
worth re-testing once a third source-reading module exists.
