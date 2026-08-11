# function-introspection / bound

## Mental model

A bound function does not announce itself. `Function.prototype.bind` records its target in
`[[BoundTargetFunction]]`, and that slot has no reader — no method, no accessor, no tag.
Everything reachable is circumstantial.

So this module does not ask "is this bound?" It asks **how much evidence of binding does
this value carry?**, and it offers that answer at two strengths. Both exports read the
same three marks past the same entrance-level, and differ only in how many marks they
require.

That framing is the module's whole shape. It is why the exports are named `doesIndicate…`
rather than `is…`, why they return a plain `boolean`, and why they grant no narrowing: a
`value is X` signature would make the compiler treat forgeable evidence as settled
everywhere downstream. See #088.

## The entrance-level

A verified function with no own `prototype`. Both predicates apply it before reading any
mark, and it does more work than it looks like it does.

`bind` never grants a `prototype`, and `prototype` is `configurable: false` where it
exists — so no ordinary function can shed one to masquerade as bound. The entrance-level
therefore excludes the entire population of plain functions, classes and generator
functions in one descriptor read, before any mark is consulted.

It also has one standard counterexample, which is documented rather than fixed. `bind`
preserves the target's `[[Prototype]]`, so binding `Function.prototype` yields a value
that inherits no `call`/`apply`/`bind` and fails the callability check. Being bound does
not imply being a verified function.

## The three marks, and why order differs per predicate

1. **A `[[Construct]]` slot**, with the `Proxy` constructor subtracted. Past the
   entrance-level almost nothing else holds one.
2. **The condensed anonymous native source.** The mark that survives a bound function
   whose `name` was overwritten.
3. **A `'bound '` prefix on the own `name`.** Forgeable — `name` is `configurable` on
   every function — and reached only where the first two miss.

The two predicates order these marks **oppositely, and the asymmetry is deliberate.**

The recall-first predicate is a cascade, so any mark ends the question. It orders by
**decisiveness**: the `[[Construct]]` probe allocates a `Proxy` and performs a `new`,
making it the most expensive read, but a short-circuit spends that cost only where it
settles the answer outright.

The precision-first predicate is a conjunction, so the first mark to **fail** ends it. It
orders **cheapest-first**: two descriptor reads, then a string allocation, then the
`Proxy`-allocating probe last.

Reading either ordering in isolation looks like an inconsistency. Both sites say so.

## What the two strengths cost each other

The cascade degrades to a **weaker answer**; the conjunction degrades to **silence**. That
is the choice a consumer makes when picking one.

The conjunction also applies the `[[Construct]]` mark conditionally rather than requiring
it. A bound arrow or bound concise method never had a construct slot, so demanding one
would reject half the bound forms. What the clause contributes there is the `Proxy`
subtraction, which only bites where a slot exists.

## Cross-realm

No realm-fixed identity is consulted. All three marks are structural — a descriptor shape,
a source string, a name prefix — so a foreign bound function is read exactly as a local
one is. The `Proxy` subtraction is likewise structural, which is what lets it recognize a
foreign `Proxy` constructor it has never seen.

## Open architectural questions

**Mark 3 is engine-dependent, and the dependence is not testable here.** On V8 every
genuinely bound value also fires mark 2, so mark 3 never decides for a real bound
function. It exists for engines whose built-ins stringify identically bound or unbound —
Safari among them, per a three-browser observation this project cannot reproduce under
Node. The spec records the vector that pins mark 3's decision path; the engine claim
itself rests on that observation.

**Whether the pair should ever collapse to one export.** Two predicates over one subject
is justified while consumers genuinely differ on recall-versus-precision. Nothing yet
demonstrates that they do.
