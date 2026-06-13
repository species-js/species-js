# 045 — Tag-signature cross-validator added to `isDictionaryObject`

**Date:** 2026-06-08

**Context.** The initial `isDictionaryObject` was a three-marker check: `isObject` gate,
`getPrototypeOf === null`, and `getDefinedConstructor === undefined`. The two non-gate
markers are independent cross-validators for the prototype-less state. Decision #044's
audit of the object-predicate family asked whether the same string-shape signal that
anchors `isPlainObject`'s identity-signal could close any residual surface here.

**Decision.** Add the tag-signature cross-validator
`getTypeSignature(value) === '[object Object]'` as a fourth marker. The full chain:

```js
isObject(value) &&
  getPrototypeOf(value) === null &&
  getDefinedConstructor(value) === undefined &&
  getTypeSignature(value) === '[object Object]';
```

**Rationale.** The new marker closes a rare-but-real surface: an attacker (or buggy code)
can attach an own `Symbol.toStringTag` data property to a prototype-less object to lie
about its `[[Class]]`. The two prior markers (`proto === null`,
`constructor === undefined`) confirm the prototype-less state but say nothing about the
tag. For the hashmap semantic `DictionaryObject` targets, no legitimate consumer would set
a tag — they want the prototype-less state for key-collision safety, not for
class-identity projection.

The marker is cheap (one O(1) `toObjectString.call` capture invocation) and consistent
with the surface's own conservative-narrowing posture: three independent cross-validators
behind the `isObject` gate.

**Consequences.** False-positive surface narrowed. False-negative cost is zero in
practice: the marker only rejects prototype-less objects with own `Symbol.toStringTag`
properties, which is not a shape legitimate hashmap use produces. The doc, the test plan,
and the module-level mental model all describe four markers, not three.
