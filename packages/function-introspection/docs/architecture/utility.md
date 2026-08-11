# function-introspection / utility

## Mental model

Two of this package's three modules classify by reading source. `utility` is the layer
they read through, and it carries no classification logic of its own. It answers two
questions:

- **What does this callable's source look like, normalized?**
- **Is this callable the `Proxy` constructor?**

It sits below `bound` and `concise` in the dependency graph, mirroring type-detection's
module of the same name.

## Why condensation exists at all

Engines disagree about whitespace in `[[SourceText]]`. V8 renders a native function as
`function () { [native code] }`; JavaScriptCore and SpiderMonkey insert newlines; others
use tabs. A comparison against any one of those spellings is a comparison against one
engine.

Condensing removes whitespace adjacent to `(`, `)`, `{`, `}`, `[`, `]` and leaves every
other run intact. All the engine spellings then collapse onto one string, and **that is
what makes `[native code]` detection portable**.

Two details of that rule are load-bearing rather than incidental:

- **The interior space in `[native code]` is preserved.** Without it the marker would fuse
  into `[nativecode]`, a legal identifier a concise method can carry as an array literal —
  a forgery needing no `Proxy`.
- **A name survives condensation.** `function max() { [native code] }` does not reduce to
  the anonymous form, which is exactly what lets `bound` tell a bound built-in from the
  native it was bound from.

## Two readers, and why both

The module exposes the condensed source twice, and the duplication is deliberate.

`getCondensedFunctionSource` takes a **callable** and composes the read with the
condensate. `bound` uses it.

`getFunctionSourceCondensate` takes a **string**. `concise` uses it, because it has
already read the source once and will not pay a second `toString`. The string-taking form
has a second purpose that the callable-taking one cannot serve: it lets engine-specific
spellings be exercised under a single-engine test runner. The JavaScriptCore and
SpiderMonkey forms are unreachable through the callable in Node, and they are the reason
this export exists.

## The absorption is a guarantee, not an affordance

The source read goes through this package's own realm-fixed capture of
`Function.prototype.toString`, never through the value's own. A function whose instance
`toString` was replaced or deleted still yields its real source. #086 explains why each
package captures its own.

That read is throw-safe: a non-callable produces `undefined` rather than propagating a
`TypeError`. **Callers must not treat that as a guard.** The exception is absorbed by
_catching_ it, and an engine-thrown exception is roughly two orders of magnitude dearer
than the `typeof` test that would have prevented it. Every predicate in `arrow` and
`concise` therefore narrows with `isFunction` before reading source. The absorption exists
so a hostile callable cannot make a predicate throw — not so callers can skip a check.

## Identifying the `Proxy` constructor

`bound`'s first mark would otherwise fire on `Proxy` itself, which holds a construct slot
and no own `prototype`. Subtracting it takes two steps, cheap one first.

**Identity** settles the local realm in one reference compare. **Descriptor shape**
settles every other: an own `name` of `'Proxy'`, an own `length` of `2` or a callable own
`revocable`, and the named native source form. Structural rather than nominal, which is
what lets it recognize a foreign `Proxy` it has never seen.

One branch of that shape check is unreachable under V8 — every real `Proxy` has
`length === 2` and short-circuits first, while the named-native source check blocks any
fake. It is documented as deliberately uncovered, and a test should not be contorted to
reach it.

## Open architectural questions

**`hasProxyConstructorShape` has a single consumer**, `doesMatchProxyConstructor`.
Shared-layer code with one consumer is worth re-examining, though it is defensible here:
it answers a general question about the `Proxy` constructor and is separately testable.

**Whether a second package will want this module.** type-detection has its own `utility`
with a different surface. If a third package needs source condensation, the pattern moves
up rather than being copied a third time.
