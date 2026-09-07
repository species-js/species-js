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

## Three marks, but only two of them are portable

1. **A `[[Construct]]` slot**, with the `Proxy` constructor subtracted. Past the
   entrance-level almost nothing else holds one.
2. **The condensed native source.** Read only by the precision-first predicate.
3. **A `'bound '` prefix on the own `name`.** Forgeable — `name` is `configurable` on
   every function.

Marks 1 and 3 come from the language: `bind` grants the construct slot when its target is
a constructor, and it always prefixes the name. Mark 2 does not.
`Function.prototype.toString` is implementation-defined for an exotic, and JavaScriptCore
puts the bound target's name where V8 and SpiderMonkey put nothing.

That split is now the architecture. The **recall-first predicate reads marks 1 and 3
only**, so it answers the same on every conforming engine — including engines nobody has
run it on. The **precision-first predicate also reads mark 2**, and buys precision with
portability: it is built twice and dispatched per realm. See ADR #100.

The two predicates order their marks **oppositely, and the asymmetry is deliberate.**

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
one is. Cross-REALM and cross-ENGINE are separate questions: every mark travels across
realms, but only marks 1 and 3 travel across engines. The `Proxy` subtraction is likewise
structural, which is what lets it recognize a foreign `Proxy` constructor it has never
seen.

## Open architectural questions

**Resolved 2026-09-07 — the engine dependence is measured, not assumed.** This section
used to call mark 3's engine dependence untestable here, and to say that the third mark
was never what settled a real bound value. Both statements were true of a V8-only test
suite and false of the library. `browser.probes.mjs` now executes the question in
Chromium, Firefox and WebKit, and what it found was larger than the old note supposed: on
JavaScriptCore mark 2 misses **every** bound value whose target carries a name, not only
built-ins. Mark 3 decides constantly there.

The resolution split the two predicates by whether they read the source at all — see the
marks section above and ADR #100. Nothing about the engine claim now rests on an
observation this project cannot reproduce.

**Whether the pair should ever collapse to one export.** Two predicates over one subject
is justified while consumers genuinely differ on recall-versus-precision. Nothing yet
demonstrates that they do.
