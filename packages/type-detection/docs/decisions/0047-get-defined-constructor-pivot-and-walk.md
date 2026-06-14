# 047 — `getDefinedConstructor` rewritten as inert pivot-and-walk with `assumePrototype` option

**Date:** 2026-06-09

**Context.** The original `getDefinedConstructor` walked four sources in fixed order: the
value's own `constructor` descriptor with a `??` fallback to direct property access, then
the meta-constructor via direct access, then the same pair on the prototype side. The
2026-06-08 audit (F2.1) flagged the `??` fallback as a latent accessor-invocation surface:
when the own `constructor` descriptor is an accessor, `?.value` yields `undefined` and the
`??` falls through to `value.constructor`, which invokes the getter. The function name did
not advertise inertness, but downstream consumers (`hasPlainObjectPrototypeContract`,
`getDefinedConstructorName`, `resolveType`) expected predicate-like safety. The original
audit recommendation was "acknowledge non-inertness in doc" — purely defensive. The user
chose a deeper refactor.

The refactor also exposed a separate question — the four-source walk's meta-constructor
recovery resolved tampered own-`constructor` references (e.g.,
`{ constructor: 'not a function' }`) to `String` via the wrapper's prototype chain. That
behavior was unintentional, leaked through ECMA-262 §20.1.2.9's `ToObject` coercion in
`Object.getOwnPropertyDescriptor`, and made the function's contract murky.

**Decision.** Replace the four-source walk with a pivot-and-walk inert design:

```js
export function getDefinedConstructor(value = null, options) {
  if (value === null) return void 0;
  const { assumePrototype = false } = options ?? {};
  const type = isCallable(value) || assumePrototype ? value : getPrototypeOf(value);

  const creator = getNextAvailablePropertyDescriptor(type, 'constructor')?.value ?? null;
  if (isFunction(creator)) return creator;
  if (creator !== null) {
    const constructor = getNextAvailablePropertyDescriptor(creator, 'constructor')?.value;
    if (isFunction(constructor)) return constructor;
  }
  return void 0;
}
```

Three architectural moves:

1. **Pivot semantic.** Callable values are walked from themselves (finding their own
   constructor: `Function`, `%GeneratorFunction%`, `%AsyncFunction%`, etc.). Non-callable
   values are walked from their `[[Prototype]]`, deliberately bypassing the value's own
   `constructor` data descriptor. User-supplied tampering (e.g., `{ constructor: Array }`)
   cannot influence the result — the function reflects the structural type via the
   prototype chain, not the value's overrides.

2. **Generator-family meta-walk preserved.** The first descriptor walk may land on a
   `constructor` descriptor whose value is an OBJECT, not a function — specifically
   `%GeneratorFunction.prototype%` or `%AsyncGeneratorFunction.prototype%` per ECMA-262
   §27.5.1 / §27.6.1. A second descriptor walk on that object recovers the actual function
   constructor (`%GeneratorFunction%`, `%AsyncGeneratorFunction%`). This resolves the
   user-stated edge case: "constructor pointing at an object like it happens with
   generator and async-generator objects."

3. **`assumePrototype` option.** Bypassing the value's own constructor is correct for
   instances but wrong for prototype objects, whose own `constructor` IS the spec-mandated
   source (ECMA-262 §10.2.6). Without the option,
   `getDefinedConstructor(Object.prototype)` would walk to `null` and return `undefined`,
   breaking `hasPlainObjectPrototypeContract`. With `{ assumePrototype: true }`, the walk
   starts at the value itself, reading the prototype's own `constructor` data descriptor.

The function is now **fully inert** — both stages use
`getNextAvailablePropertyDescriptor`, which inspects descriptors without invoking any
accessor getter. F2.1 is closed by code rather than by doc.

**Rationale.** Five forces converge:

- **Spec-grounded over heuristic.** The pivot reflects ECMA-262's distinction between
  function objects (whose constructor is reached through Function.prototype's chain) and
  instances (whose constructor is reached through their `[[Prototype]]`'s chain).

- **Inert by construction.** The descriptor-walk discipline aligns with decision #021's
  third pattern ("predicate over inherited → descriptor-walk for inspection without
  invocation"). `getDefinedConstructor` is not a predicate, but its downstream consumers
  are predicate-shaped, and they benefit from the inertness propagating up.

- **Generator family is first-class.** The meta-walk recovery is now spec-cited and
  documented per family, not an emergent fallback. The user-stated edge case has a named,
  traceable resolution path.

- **Tamper-override surface uniformly closed.** Any user-supplied own `constructor` on a
  non-callable, non-prototype value is bypassed — the function reflects structural type,
  not the value's claim about itself. Aligned with the package's conservative-narrowing
  posture (decision #010).

- **Layered option, not behavior fork.** `assumePrototype` is a single, narrow,
  semantically-clear knob: "treat this value as its own type-source rather than walking
  up." It maps to a real spec invariant (function-created prototypes carry an own
  `constructor`) and has one known call site (`hasPlainObjectPrototypeContract`).

**Consequences.** The refactor changes `getDefinedConstructor`'s behavior on three input
classes:

| Input                         | Old                                    | New                                                   |
| ----------------------------- | -------------------------------------- | ----------------------------------------------------- |
| `{ constructor: 'tampered' }` | `String` (meta-walked via wrapper)     | `Object` (override bypassed)                          |
| `{ constructor: false }`      | `Boolean`                              | `Object`                                              |
| `{ constructor: Array }`      | `Array`                                | `Object`                                              |
| `Object.prototype`            | `Object`                               | `undefined` (without option) / `Object` (with option) |
| `Array.prototype`             | `Array`                                | `Object` (without option) / `Array` (with option)     |
| Generator-family instances    | recovered via the old four-source walk | recovered via the new meta-walk; cleaner trace        |

Standard cases (`new Date()`, `[]`, `{}`, `Object.create(null)`, primitives, async
functions) are unaffected.

**Downstream call-site updates.** `hasPlainObjectPrototypeContract` in `@/object` now
passes `{ assumePrototype: true }` (its `prototype` argument is the result of
`getPrototypeOf(value)`, which IS a real prototype object). Without the option, the
function would overshoot for canonical local-realm and cross-realm plain objects, breaking
`isPlainObject`'s structural-anchor path. Inline comment at the call site names the spec
invariant.

**`hasInert*` family completion.** The same round added three siblings to
`hasInertMethod`: `hasInertGetter` (probe for accessor `get`), `hasInertSetter` (probe for
accessor `set`), and `hasInertValue` (probe for data-descriptor presence, distinguishing
`{ value: undefined }` from "no descriptor" via `objectHasOwn`). All four are `@internal`
with parallel `.d.ts` declarations per decision #015. `objectHasOwn` is the new `@/config`
import in `@/utility`; the unused `isNewableFunction` import was dropped.

Commit `be32d4d`. See
[`../architecture/object.md`](../architecture/object.md#structural-anchor-for-isplainobject)
— "Structural anchor for `isPlainObject`" for the updated call site.
