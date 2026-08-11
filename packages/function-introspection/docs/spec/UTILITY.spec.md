# utility — behavioral specification

> Spec format and the multi-axis model are defined in
> [type-detection's spec README](../../../type-detection/docs/spec/README.md); this
> package follows the same model and does not restate it. Vectors are reasoned from the
> canon (`utility/index.js`, `utility/index.d.ts`, decisions #086 and #088). Status:
> **FROZEN 2026-08-11 — extracted in full from `BOUND.spec.md`.**
>
> No vector was re-derived and no verdict changed. Every one of the eighteen below passed
> the decidability check for `BOUND.spec.md` on 2026-08-06 and is the live oracle for
> `test/utility/__config.js`, which is committed and green. The extraction was triggered
> by the module gaining its second consumer: `concise` imports
> `getFunctionSourceCondensate` and `CONDENSED_NATIVE_SOURCE_FOUNDATION`, so the helper
> contracts could no longer live inside one consumer's spec. See Resolved item 1.

## Module contract

`function-introspection / utility` hosts the shared primitives its sibling modules read
source through. It answers two questions and carries no classification logic of its own:

- **What does this callable's source look like, normalized?** — a condensed source form in
  which whitespace adjacent to brackets is removed, so engine-specific spellings of the
  same function collapse onto one string. This is what makes `[native code]` detection
  portable.
- **Is this callable the `Proxy` constructor?** — by identity in this realm, by descriptor
  shape in any other.

The module sits below `bound` and `concise` in the dependency graph. It is re-exported
nowhere and published as no subpath (#085's barrel rule); only
`getCondensedFunctionSource` reaches a consumer, through the package barrel.

**Realm-fixed captures stay `@internal` and each package captures its own** (#086). The
source read goes through this package's own capture of `Function.prototype.toString`, not
through the value's `toString`, so replacing or deleting an instance `toString` cannot
influence any answer here.

### Throw-safety

All four functions carry `@@throw-safe`. The marker's contract for a **narrowed**
parameter is package policy, settled in [`BOUND.spec.md`](./BOUND.spec.md) (Module
contract, with Resolved item 1 for provenance). In short: no throw for any value within
the declared type, and the type is the enforcement. It is cited rather than restated so
the two specs cannot drift apart on it.

Two of this module's parameters are narrowed and are the reason that policy exists:
`getFunctionSourceCondensate(source: string | undefined)` and
`hasProxyConstructorShape(value: VerifiedFunction)`. An axis-3 suite must therefore feed
them hostile values **of those types**. Feeding `42` to the `string | undefined` parameter
tests nothing about the marker, and reports a defect that is not one.

## Surface inventory

| Export                               | Visibility  | `@@throw-safe` | Consumers          |
| ------------------------------------ | ----------- | -------------- | ------------------ |
| `getCondensedFunctionSource`         | public      | yes            | barrel, `bound`    |
| `getFunctionSourceCondensate`        | `@internal` | yes            | `concise`          |
| `hasProxyConstructorShape`           | `@internal` | yes            | `doesMatchProxy…`  |
| `doesMatchProxyConstructor`          | `@internal` | yes            | `bound`            |
| `CONDENSED_NATIVE_SOURCE_FOUNDATION` | `@internal` | n/a (constant) | `bound`, `concise` |

The two source readers are consumed differently, and the difference is the reason both
exist. `bound` takes the composed `getCondensedFunctionSource`, which reads a callable.
`concise` takes the raw `getFunctionSourceCondensate`, because it already holds the source
and will not pay a second `toString`. So `getFunctionSourceCondensate` has one direct
consumer and one indirect one, through the composition.

`hasProxyConstructorShape` has a single consumer, `doesMatchProxyConstructor`. That is
accepted rather than inlined: it answers a general question about the `Proxy` constructor
and is separately testable, which is what a shared-primitives module is for.

## `CONDENSED_NATIVE_SOURCE_FOUNDATION`

The canonical condensed spelling of an anonymous native function:

```
'function(){[native code]}'
```

- `CNSF/A1` — every engine's anonymous native source condenses to exactly this string.
- `CNSF/A2` — the single interior space in `[native code]` is **load-bearing and
  deliberate**; see `gFSC/R2`. Removing it would fuse the marker into the legal identifier
  `[nativecode]`, which a concise method can carry as an array literal — a forgery needing
  no `Proxy`.

## `getCondensedFunctionSource(value: Callable): string | undefined` — public

Reads the source through the realm-fixed `Function.prototype.toString` and returns it
condensed. Composition: `getFunctionSourceCondensate(getFunctionSource(value))`.

- `gCFS/A1` — a bound function → `'function(){[native code]}'`.
- `gCFS/A2` — `Proxy` → `'function Proxy(){[native code]}'`.
- `gCFS/A3` — `(a) => a` → `'(a)=> a'` — whitespace next to `)` is removed, the space
  after `=>` survives. Looks like a typo; it is the specified behavior.
- `gCFS/A4` — a non-callable → `undefined` — `getFunctionSource` absorbs the `TypeError`.

**`Function.prototype.toString` never returns a non-string.** ECMA-262 §20.2.3.5 returns a
String or throws a TypeError; there is no third outcome, and it throws only for a
non-callable. So the `| undefined` arm is reachable **only** by out-of-contract input.
That was verified across fourteen callable shapes — a revoked `Proxy`, a `Proxy` with a
throwing `get` trap, a `Function` subclass instance, a hostile subclass — all of which
return strings.

**`gCFS/A4` costs, and callers must not rely on it as a guard.** The `TypeError` is
absorbed by CATCHING it. An engine-thrown exception is roughly two orders of magnitude
dearer than the `typeof` test that would have prevented it. Every predicate in `arrow` and
`concise` therefore narrows with `isFunction` before reading source — measured 2026-08-11
at ~8 µs per non-callable without the guard, against 0.04 µs with it. The absorption is a
correctness guarantee, not a performance affordance.

## `getFunctionSourceCondensate(source: string | undefined): string | undefined` — `@internal`

Removes whitespace adjacent to `(`, `)`, `{`, `}`, `[`, `]`; leaves every other run
intact.

- `gFSC/A1` — `'function () { [native code] }'` (V8) → the canonical form.
- `gFSC/A2` — `'function () {\n    [native code]\n}'` (JavaScriptCore / SpiderMonkey) →
  the canonical form.
- `gFSC/A3` — `'function\t()\t{\t[native code]\t}'` (tabs) → the canonical form.
- `gFSC/A4` — `'function(){[native code]}'` (already condensed) → unchanged.
- `gFSC/R1` — `'function max() { [native code] }'` → **not** the canonical form; the name
  survives, which is what separates a bound function from the native it was bound from.
- `gFSC/R2` — `'m() { [nativecode] }'` → **not** the canonical form. The interior space in
  `[native code]` is preserved deliberately: without it the marker would fuse into the
  legal identifier `[nativecode]`, which a concise method can carry as an array literal —
  a forgery needing no `Proxy`.
- `gFSC/X1` — `undefined` → `undefined`; `''` → `''` — falsy input returned unchanged.

Takes the source rather than the callable **so that engine-specific forms can be exercised
under a single-engine test runner**. `A2` and `A3` are unreachable through
`getCondensedFunctionSource` in Node, and they are the reason this export exists.

## `hasProxyConstructorShape(value: VerifiedFunction): boolean` — `@internal`

Own-descriptor shape of a `Proxy` constructor: own `name` of `'Proxy'`, **and** either an
own `length` of `2` or a callable own `revocable`, **and** the named native source form.

- `hPCS/A1` — the `Proxy` constructor → true.
- `hPCS/A2` — a cross-realm `Proxy` constructor → true — structural, not nominal.
- `hPCS/R1` — `Proxy.bind(null)` → false — `name` is `'bound Proxy'`.
- `hPCS/R2` — any other callable → false.

**One branch is deliberately uncovered.** `isFunction(revocable?.value)` is unreachable
under V8: every real `Proxy` has `length === 2`, which short-circuits first, and the named
native source check blocks any fake. Do not contort a test to reach it.

## `doesMatchProxyConstructor(value: VerifiedFunction): boolean` — `@internal`

This realm's capture by identity, then `hasProxyConstructorShape` for every other realm.
Identity first because it is one reference compare; the descriptor walk only pays for
values that are not the local intrinsic.

- `dMPC/A1` — the `Proxy` constructor → true (identity arm).
- `dMPC/A2` — a cross-realm `Proxy` constructor → true (shape arm).
- `dMPC/R1` — a plain function, a bound `Proxy` → false.

## Throw-safety (axis 5) — completeness oracle

Four exports carry `@@throw-safe`, in both files of the pair:

| export                        | `.js` | `.d.ts` |
| ----------------------------- | ----- | ------- |
| `getCondensedFunctionSource`  | ✓     | ✓       |
| `getFunctionSourceCondensate` | ✓     | ✓       |
| `hasProxyConstructorShape`    | ✓     | ✓       |
| `doesMatchProxyConstructor`   | ✓     | ✓       |

The axis-5 suite asserts the triple-lock: the markers found in source ⟺ the set declared
in `test/utility/__config.js` (`THROW_SAFE_MARKED`) ⟺ the set actually exercised. Each
marked export is fed hostile values **of its declared parameter type**:

- for the `Callable` parameter — a revoked `Proxy`, proxies with throwing
  `getOwnPropertyDescriptor` / `get` / `ownKeys` traps, a function with an accessor `name`
  that throws, a null-prototype callable;
- for the `string | undefined` parameter — `''`, whitespace-only, punctuation soup, a lone
  surrogate, combining marks, a 1 MB string, embedded NUL, an RTL override, emoji;
- for the `VerifiedFunction` parameters — the hostile callables from the first list.

`#bound`'s two marked exports are scored by `test/bound/__config.js`, and each new module
scores its own; the parser (`test/_marked-exports.js`) is given one module path at a time,
so the sets never merge.

## Resolved items

1. **Extracted from `BOUND.spec.md` (2026-08-11).** The helper contracts were written into
   the `bound` spec because `bound` was then the only consumer. `concise` became the
   second — it imports `getFunctionSourceCondensate` and
   `CONDENSED_NATIVE_SOURCE_FOUNDATION` — which was the recorded trigger for the split,
   mirroring type-detection's standalone `UTILITY.spec.md`. **A move, not a
   re-derivation:** all eighteen vectors carry their original identifiers and verdicts.
   Two facts were folded in from the module docs rather than invented here — the uncovered
   `hasProxyConstructorShape` branch, and the cost of `gCFS/A4` established by the
   2026-08-11 entrance-level measurement. `BOUND.spec.md` was amended in place (#054) with
   a dated banner and a pointer.
2. **The axis-5 table was already wrong to sit in `BOUND.spec.md`.** It listed six exports
   as that module's marked set while `test/bound/__config.js` scores only its own two and
   defers the other four to `test/utility/__config.js`. The spec was describing a merged
   oracle the tests never had. Splitting the table brings the spec back in step with the
   test architecture rather than changing either.
