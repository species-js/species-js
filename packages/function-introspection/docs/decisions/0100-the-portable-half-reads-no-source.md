# 100 — The portable half reads no source

**Date:** 2026-09-07

**Context.** `doesIndicateBoundFunction` read three marks and admitted a value that
carried any one of them: a `[[Construct]]` slot past the entrance-level, an anonymous
`[native code]` source, or a `'bound '` prefix on the own `name`.

The middle one was always the odd member, and two things this week made that legible.

First, the browser check began executing the question instead of citing it. It found that
JavaScriptCore renders the bound target's name into the native source form, so the
anonymous-form comparison misses there — and not only for built-ins, as the sources and
the spec both claimed, but for every bound value whose target carries a name. Measured on
WebKit 26.5: `plain.bind(null)` renders `'function plain(){[native code]}'`, and `plain`
is an ordinary user function.

Second, probe B8 had been reporting a defect that was not one. It asserted that a bare
`Proxy` over a concise method is bound-indicating, which is what V8 answers — and V8
answers it only because V8 renders a callable `Proxy` anonymously. JavaScriptCore names
the exotic and answered `false`. Between the two, the engine we were treating as broken
was giving the more truthful answer.

**Decision.** `doesIndicateBoundFunction` no longer reads the function source. Its
contract is the entrance-level plus mark 1 OR mark 3.

This **amends #088's Consequences**, which counted the disagreement between the two
predicates at five values. #088's decision — the `doesIndicate` prefix, the plain
`boolean`, the qualified variants — is untouched.

`doesStronglyIndicateBoundFunction` is unchanged and still reads all three.

## Why the source is not evidence of binding

Mark 2 asks whether a value stringifies as an anonymous native function. Bound functions
do. So does every callable `Proxy`, and so does `Function.prototype`. What it really tests
is _exotic callable without source text_, which is a strictly larger set than _bound_.

A superset test used as a positive disjunct admits everything in the superset. That is not
a tuning problem, it is the shape of the thing: no refinement inside that branch can help,
because any refinement that excludes the proxies also excludes nothing else — we checked,
and the refined form reduces algebraically to dropping the mark.

## Why this makes the predicate portable

The two surviving marks are mandated by the language rather than left to the
implementation:

- `BoundFunctionCreate` gives the exotic a `[[Construct]]` slot exactly when its target is
  a constructor.
- `Function.prototype.bind` always sets the name through
  `SetFunctionName(F, targetName, "bound")`. Measured at the edges: a numeric target name
  yields `'bound '`, an accessor `'bound getter'`, an empty string `'bound '`. There is no
  path on which the prefix is absent.

`Function.prototype.toString`, by contrast, is implementation-defined for an exotic — and
it was the only such input this predicate had. Removing it means the answer follows from
the specification, so it holds on engines nobody has tested, not merely on the three that
were.

That is a contract a consumer can depend on. The previous behaviour was not one: it was
correct on Chrome and Firefox and different on Safari, which for a foundation package six
projects build on is a support burden that propagates outward.

## What it costs

A bound **arrow, concise method, generator or non-constructable native** whose `name` was
overwritten is now reported `false`. Mark 2 was the only mark that reached it.

A bound ordinary function or class survives the same erasure, because it keeps its
construct slot. The loss is therefore narrower than it first appears, and it was never a
cross-engine guarantee: JavaScriptCore never caught that case either, so what ends is a
Chrome-and-Firefox bonus rather than a promise.

It is also self-inflicted by the caller. `name` is `configurable` on every function, and
the cascade already treats a _forged_ name as authoritative — an arrow renamed `'bound x'`
is admitted, a documented boundary. Trusting the name when present while refusing to trust
its absence was the inconsistency; the two directions are now symmetric.

## What it buys

- A bare `Proxy` over an unbound callable is refused. A `Proxy` over a **bound** function
  is still admitted, because it forwards the `'bound …'` name and the value behind it
  really is bound. The proxy question is answered by what the proxy shows, on every engine
  alike.
- `Function.prototype` is refused. It is native and unnamed and was never bound.
- The disagreement set between the two predicates drops from five values to three, because
  the two predicates now agree on the values neither should have admitted.
- The subset law survives and becomes trivial: the conjunction requires mark 3, and the
  cascade admits anything carrying it.

## Alternatives considered

**Reclassify B8 as an engine profile.** Proposed first, on the reasoning that neither
answer was reachable on both engines. That was true only while the mark set was held
fixed. Once it was not, a portable `false` became reachable, and a contract beats a
profile.

**Detect the `Proxy` directly.** Not available. Proxy transparency is deliberate: every
readable channel forwards to the target. `util.types.isProxy` is a Node host API, which
#095 already declined for this kind of use — a native accelerator is acceptable when it is
a language standard, not when it is a host API.

**Widen mark 2 to accept any native form.** Makes the engines agree by admitting every
prototype-less built-in, `Math.max` included. It converges the two engines on a worse
answer.

**Keep mark 2 and accept the divergence.** Defensible if consumers read the cascade as "is
this opaque, be careful" rather than "is this bound" — its false positives are all values
that reading would want flagged. Rejected because the identifier promises the second, and
because a consumer wanting the first can call the public `getCondensedFunctionSource` and
ask directly.

## Consequences

- `BOUND.spec.md` amended under #054: two vectors withdrawn, two added, one narrowed, the
  disagreement set corrected. See its Resolved item 7.
- Probe B8 now expects `false` on every engine and stays in layer B, joined by a new claim
  that a `Proxy` over a bound function is still admitted — the case this change could
  otherwise have broken silently.
- A smoke probe asserts the same three answers over the built bundle, where bundling
  rewrites source text and a source-reading predicate would have noticed.
- The `browser.yml` run drops from two failures to one. What remains is the false positive
  in `concise.js`, which is untouched by this and is a genuine defect.
