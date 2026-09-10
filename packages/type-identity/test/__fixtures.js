// @ts-check

/**
 * @module test/__fixtures
 *
 * The value universe the suites are specified over: named factories, one per
 * shape, each returning a FRESH value on every call.
 *
 * ## Why the fixtures live apart from the matrices
 *
 * The sibling packages keep both in one `__config.js`, and for a module with a
 * single predicate that is the right size. Here the same universe is scored by
 * six suites against three entries, two of which are mutators — so "which
 * values exist" is shared by everything while "what is claimed about them"
 * has exactly one consumer per matrix. Splitting the two keeps either file
 * readable; `__config.js` imports from here and adds the claims.
 *
 * ## Freshness is not a style choice here
 *
 * Every operation this package performs is a ONE-WAY DOOR. A frozen `name` can
 * never be reshaped, so a constructor that two vectors share makes test ORDER
 * load-bearing: whichever vector runs second meets an already-frozen target and
 * fails at condition 7 for a reason that has nothing to do with what it was
 * asserting. Nothing below is exported as a value; everything is a factory.
 *
 * The one shape that cannot be made fresh is a built-in — there is only one
 * `Math.max` per realm — which is why `brand/B1` is confined to a private
 * foreign realm (`_cross-realm.js` explains the isolation).
 *
 * ## The lint shapes
 *
 * A synthetic `class` needs one body-bearing member: an empty `class C {}`
 * trips `no-extraneous-class`, an empty method trips `no-empty-function`, and a
 * literal getter trips `class-literal-property-style`. A method with a `return`
 * clears all three, and `identify()` is that member throughout.
 */

import { objectCreate } from '@species-js/type-detection';

import { defineProperty, getOwnPropertyDescriptor } from '#config';

import { createForeignRealm, foreignRealmEval } from './_cross-realm.js';

/** @typedef {import('@species-js/type-detection').Callable} Callable */
/** @typedef {import('@species-js/type-detection').NewableFunction} NewableFunction */

/**
 * A `defineProperty` trap, with the optionality `ProxyHandler` gives every trap
 * stripped off. `exactOptionalPropertyTypes` is on workspace-wide, so the
 * handler's own member type carries `| undefined` and a parameter declared as
 * that member would admit one — which no factory below would know what to do
 * with.
 *
 * @typedef {NonNullable<ProxyHandler<object>['defineProperty']>} DefinePropertyTrap
 */

/**
 * A property descriptor whose `value` is `unknown` rather than the lib's `any`.
 *
 * Every suite here reads descriptors, and the lib's `any` would launder a
 * mistake at each read site — the `no-unsafe-*` family is the workspace's
 * standing objection to exactly that. Retyping once, where the descriptors
 * enter, keeps the acknowledgement in one place instead of at every consumer.
 *
 * @typedef {Omit<PropertyDescriptor, 'value'> & { value?: unknown }} SafeDescriptor
 */

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Shape Helpers
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * Writes a constructor's own `prototype` slot by ASSIGNMENT.
 *
 * The double cast is the point rather than an inconvenience: an ES3 function's
 * `prototype` is typed as its instance type, and several vectors deliberately
 * put a non-object there (`define/R9`). Assignment is also the operation
 * `define/B2` is about — that the ES3 slot stays writable after freezing — so
 * a `defineProperty` stand-in would test something adjacent instead.
 *
 * @param {Callable} fct - the function whose `prototype` slot is written
 * @param {unknown} prototype - the value to put there
 * @returns {Callable} the same function
 */
export function withOwnPrototype(fct, prototype) {
  /** @type {{ prototype: unknown }} */ (/** @type {unknown} */ (fct)).prototype =
    prototype;

  return fct;
}

/**
 * Reads an own descriptor, normalizing the absent case to `null` so a suite can
 * assert absence with `toBe(null)` rather than on `undefined`, which is also
 * what a mistyped key produces.
 *
 * @param {object | Callable} target - the value whose own descriptor is read
 * @param {PropertyKey} key - the property key
 * @returns {SafeDescriptor | null} the descriptor, or `null` when absent
 */
export function ownDescriptorOf(target, key) {
  return getOwnPropertyDescriptor(target, key) ?? null;
}

/**
 * `new constructor()`, with the cast in one place.
 *
 * Every vector that checks what a frozen type does to its INSTANCES needs one,
 * and the constructors here are typed `NewableFunction` — a runtime narrowing
 * target, not a construct signature the compiler can call (the note on
 * parameter types in `src/index.d.ts` says why).
 *
 * @param {unknown} constructor - the constructor to construct
 * @returns {object} the instance
 */
export function instantiate(constructor) {
  return new /** @type {new () => object} */ (constructor)();
}

/**
 * `Object.prototype.toString.call(value)` — the brand a frozen tag changes.
 *
 * @param {unknown} value - the value to brand-check
 * @returns {string} its `[[Class]]` brand
 */
export function tagOf(value) {
  return Object.prototype.toString.call(value);
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Freezable Constructors
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {NewableFunction} a `class`-syntax constructor, never seen before */
export const freshClass = () =>
  /** @type {NewableFunction} */ (
    /** @type {unknown} */ (
      class Candidate {
        /** @returns {string} a value, so the class carries a member */
        identify() {
          return 'candidate';
        }
      }
    )
  );

/** @returns {NewableFunction} an ES3 constructor function, never seen before */
export const freshES3 = () => {
  /** @returns {undefined} nothing — the body exists so the function is not empty */
  function Candidate() {
    return undefined;
  }

  return /** @type {NewableFunction} */ (/** @type {unknown} */ (Candidate));
};

/**
 * A base class and a class derived from it, both fresh.
 *
 * The pair is what `define/B6` and `carry/B5` need: the tag is inherited down
 * the chain while the verdict is read from own descriptors, so the two answers
 * come apart only when both halves of the hierarchy are in hand.
 *
 * @returns {{ Base: NewableFunction, Derived: NewableFunction }} the pair
 */
export const freshClassHierarchy = () => {
  class Base {
    /** @returns {string} a value, so the class carries a member */
    identify() {
      return 'base';
    }
  }
  class Derived extends Base {
    /** @returns {string} a second member, so the subclass carries one too */
    describe() {
      return 'derived';
    }
  }

  return {
    Base: /** @type {NewableFunction} */ (/** @type {unknown} */ (Base)),
    Derived: /** @type {NewableFunction} */ (/** @type {unknown} */ (Derived)),
  };
};

/**
 * A derived class whose BASE prototype already carries a non-configurable,
 * inherited `Symbol.toStringTag` (`define/A11`).
 *
 * @returns {{ Base: NewableFunction, Derived: NewableFunction }} the pair
 */
export const freshShadowedTagHierarchy = () => {
  const { Base, Derived } = freshClassHierarchy();

  defineProperty(prototypeOf(Base), Symbol.toStringTag, {
    get: () => 'Base',
    enumerable: false,
    configurable: false,
  });

  return { Base, Derived };
};

/**
 * The `prototype` value of a constructor, read inertly.
 *
 * @param {NewableFunction} constructor - the constructor to read from
 * @returns {object} its `prototype` object
 */
export function prototypeOf(constructor) {
  return /** @type {object} */ (ownDescriptorOf(constructor, 'prototype')?.value);
}

/**
 * Two fresh ES3 constructors pointing at ONE prototype object (`define/B5`).
 *
 * @returns {{ First: NewableFunction, Second: NewableFunction, prototype: object }} the trio
 */
export const freshPrototypeSharingPair = () => {
  const prototype = {
    /** @returns {string} a value, so the object is not bare */
    identify() {
      return 'shared';
    },
  };
  const First = freshES3();
  const Second = freshES3();

  withOwnPrototype(First, prototype);
  withOwnPrototype(Second, prototype);

  return { First, Second, prototype };
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Non-Newables and Non-Callables
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A fresh host per call, so the concise method below is fresh too.
 *
 * A module-level host would hand every caller the SAME function object, and one
 * brand on it would rename it for every later vector — the freshness rule this
 * module opens with, in the one place it is easy to miss.
 *
 * @returns {{ concise: () => number }} the host
 */
const methodHost = () => ({
  /** @returns {number} a value, so the concise method is not empty */
  concise() {
    return 1;
  },
});

/** @returns {Callable} an arrow function — callable, never newable */
export const arrowFunction = () => /** @type {Callable} */ (() => undefined);

/** @returns {Callable} an `async` function — the `await` is what `require-await` wants */
export const asyncFunction = () =>
  /** @type {Callable} */ (
    async () => {
      await Promise.resolve(undefined);

      return undefined;
    }
  );

/** @returns {Callable} a generator function — newable-looking, and not newable */
export const generatorFunction = () =>
  /** @type {Callable} */ (
    function* generate() {
      yield undefined;
    }
  );

/** @returns {Callable} a concise method — prototype-less and not newable */
export const conciseMethod = () => /** @type {Callable} */ (methodHost().concise);

/** @returns {Callable} a `Proxy` over a function whose revocation already happened */
export const revokedFunctionProxy = () => {
  const revocable = Proxy.revocable(
    /** @type {Callable} */ (
      function Target() {
        return undefined;
      }
    ),
    {},
  );

  revocable.revoke();

  return /** @type {Callable} */ (revocable.proxy);
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Built-ins and Bound Newables
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {NewableFunction} `Array` — a built-in, refused on the source read */
export const builtinArray = () => /** @type {NewableFunction} */ (Array);

/** @returns {NewableFunction} `Date` — likewise */
export const builtinDate = () => /** @type {NewableFunction} */ (Date);

/** @returns {NewableFunction} `Symbol` — likewise */
export const builtinSymbol = () =>
  /** @type {NewableFunction} */ (/** @type {unknown} */ (Symbol));

/** @returns {NewableFunction} `Function` — likewise */
export const builtinFunction = () => /** @type {NewableFunction} */ (Function);

/** @returns {NewableFunction} a bound class — `bind` stripped the own `prototype` */
export const boundClass = () =>
  /** @type {NewableFunction} */ (/** @type {unknown} */ (freshClass().bind(null)));

/** @returns {NewableFunction} a bound ES3 function — likewise */
export const boundES3 = () =>
  /** @type {NewableFunction} */ (/** @type {unknown} */ (freshES3().bind(null)));

/**
 * A bound newable handed an own writable `prototype` BY HAND (`define/B4`).
 *
 * The graft passes the shape gate — the slot the gate reads is present and
 * writable again — while `new` on a bound function still consults the target's
 * prototype. That divergence is the vector.
 *
 * The grafted slot is `configurable: true`, unlike an ordinary function's,
 * which is what {@link withdrawingPrototypeProxy} needs to reach condition 9 by
 * withdrawal rather than tripping a proxy invariant at condition 8
 * (`define/B8`).
 *
 * @returns {NewableFunction} the doctored bound newable
 */
export const boundNewableWithGraftedPrototype = () => {
  const bound = boundES3();

  defineProperty(bound, 'prototype', {
    value: {
      /** @returns {string} a value, so the grafted prototype is not bare */
      identify() {
        return 'grafted';
      },
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });

  return bound;
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Proxies — Benign and Hostile
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {NewableFunction} a bare `Proxy` over an ES3 function — admitted */
export const proxyOverES3 = () =>
  /** @type {NewableFunction} */ (/** @type {unknown} */ (new Proxy(freshES3(), {})));

/**
 * A bare `Proxy` over a class — refused.
 *
 * `Function.prototype.toString` on any proxy reports the native form, so the
 * class arm's source read fails while the ES3 arm's descriptor read would have
 * passed (`define/B3`).
 *
 * @returns {NewableFunction} the proxy
 */
export const proxyOverClass = () =>
  /** @type {NewableFunction} */ (/** @type {unknown} */ (new Proxy(freshClass(), {})));

/**
 * A `Proxy` whose `getOwnPropertyDescriptor` trap ALWAYS throws.
 *
 * Refused at condition 2: the shape gate cannot read either arm's descriptor,
 * so no shape is established. The throw never escapes.
 *
 * @returns {NewableFunction} the proxy
 */
export const descriptorTrapThrowingProxy = () =>
  /** @type {NewableFunction} */ (
    /** @type {unknown} */ (
      new Proxy(freshES3(), {
        getOwnPropertyDescriptor() {
          throw new TypeError('the descriptor trap refuses every read');
        },
      })
    )
  );

/**
 * A `Proxy` that answers the shape probe truthfully and throws on the NEXT read
 * of `prototype` (`define/R8`).
 *
 * Passing the shape gate is evidence about one past read, not a promise about
 * the next, which is the reason the entry re-reads through its throw-safe
 * helper rather than reusing what the gate saw.
 *
 * @param {unknown} reason - the value the trap throws on the second read
 * @returns {{ constructor: NewableFunction, state: { reads: number } }} the
 *  proxy and the read counter, so a suite can assert the first read happened
 */
export const lateDescriptorTrapThrowingProxy = (reason) => {
  const state = { reads: 0 };
  const target = freshES3();

  const proxy = new Proxy(target, {
    getOwnPropertyDescriptor(receiver, key) {
      if (key === 'prototype') {
        state.reads += 1;

        if (state.reads > 1) {
          throw reason;
        }
      }

      return Reflect.getOwnPropertyDescriptor(receiver, key);
    },
  });

  return {
    constructor: /** @type {NewableFunction} */ (/** @type {unknown} */ (proxy)),
    state,
  };
};

/**
 * A `Proxy` that reports the grafted `prototype` once and then WITHDRAWS it
 * (`define/B8`).
 *
 * Over an ordinary function this cannot work: the own `prototype` slot is
 * non-configurable, so withdrawing it trips a proxy invariant and the engine's
 * `TypeError` surfaces at condition 8 instead. Reaching 9 by withdrawal needs a
 * target whose slot is configurable, which is what the grafted bound newable
 * is for.
 *
 * @returns {NewableFunction} the proxy
 */
export const withdrawingPrototypeProxy = () => {
  const state = { reads: 0 };
  const target = boundNewableWithGraftedPrototype();

  const proxy = new Proxy(target, {
    getOwnPropertyDescriptor(receiver, key) {
      if (key === 'prototype') {
        state.reads += 1;

        if (state.reads > 1) {
          return undefined;
        }
      }

      return Reflect.getOwnPropertyDescriptor(receiver, key);
    },
  });

  return /** @type {NewableFunction} */ (/** @type {unknown} */ (proxy));
};

/**
 * The same withdrawal over an ORDINARY function — the reproduction that does
 * NOT reach condition 9 (`define/B8`).
 *
 * An ordinary function's own `prototype` slot is non-configurable, so reporting
 * it once and then withdrawing it trips a proxy invariant. The engine's own
 * `TypeError` is what the throw-safe read then catches, and it surfaces at
 * condition 8. The spec records this input because it is the obvious attempt,
 * and it is wrong.
 *
 * @returns {NewableFunction} the proxy
 */
export const withdrawingPrototypeProxyOverOrdinaryFunction = () => {
  const state = { reads: 0 };
  const target = freshES3();

  const proxy = new Proxy(target, {
    getOwnPropertyDescriptor(receiver, key) {
      if (key === 'prototype') {
        state.reads += 1;

        if (state.reads > 1) {
          return undefined;
        }
      }

      return Reflect.getOwnPropertyDescriptor(receiver, key);
    },
  });

  return /** @type {NewableFunction} */ (/** @type {unknown} */ (proxy));
};

/**
 * An ES3 constructor whose PROTOTYPE is a `Proxy` with a hostile
 * `defineProperty` trap (`define/R12`).
 *
 * The three shapeability probes ahead of the defines read descriptors and
 * extensibility, so a trap that answers those truthfully and then refuses the
 * write is exactly what they cannot foresee — the reason condition 12 exists.
 *
 * @param {DefinePropertyTrap} defineTrap - the trap to install
 * @returns {NewableFunction} the constructor pointing at that prototype
 */
export const constructorWithHostileDefineTrap = (defineTrap) =>
  /** @type {NewableFunction} */ (
    withOwnPrototype(
      freshES3(),
      new Proxy(
        {
          /** @returns {string} a value, so the prototype is not bare */
          identify() {
            return 'hostile';
          },
        },
        { defineProperty: defineTrap },
      ),
    )
  );

/**
 * A callable `Proxy` with a hostile `defineProperty` trap (`brand/R5`).
 *
 * @param {DefinePropertyTrap} defineTrap - the trap to install
 * @returns {Callable} the proxy
 */
export const callableWithHostileDefineTrap = (defineTrap) =>
  /** @type {Callable} */ (
    /** @type {unknown} */ (new Proxy(freshES3(), { defineProperty: defineTrap }))
  );

/**
 * The `defineProperty` trap that throws whatever it is handed.
 *
 * @param {unknown} reason - the value to throw
 * @returns {DefinePropertyTrap} the trap
 */
export const throwingDefineTrap = (reason) => () => {
  throw reason;
};

/**
 * The `defineProperty` trap that LIES — it refuses the write by returning
 * falsish rather than by throwing, so the engine raises the `TypeError`.
 *
 * @returns {DefinePropertyTrap} the trap
 */
export const lyingDefineTrap = () => () => false;

/**
 * A `Proxy` over a plain object whose `getPrototypeOf` trap throws.
 *
 * The verification entry reaches `getPrototypeOf` only on the non-newable arm,
 * which is what this exercises (`carry/R8`).
 *
 * @returns {object} the proxy
 */
export const prototypeTrapThrowingProxy = () =>
  new Proxy(
    {},
    {
      getPrototypeOf() {
        throw new TypeError('the prototype trap refuses every read');
      },
    },
  );

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Slot-Shape Variants
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {NewableFunction} a frozen ES3 function — no slot can be shaped */
export const frozenES3 = () => /** @type {NewableFunction} */ (Object.freeze(freshES3()));

/** @returns {NewableFunction} a frozen class — same, one shape over */
export const frozenClass = () =>
  /** @type {NewableFunction} */ (Object.freeze(freshClass()));

/**
 * An ES3 function whose own `prototype` was made non-writable BY HAND.
 *
 * Neither shape: not writable, so not ES3; not `class`-sourced, so not the
 * class arm (`shape/R3`).
 *
 * @returns {NewableFunction} the doctored function
 */
export const nonWritablePrototypeFunction = () => {
  const F = freshES3();

  defineProperty(F, 'prototype', { writable: false });

  return F;
};

/**
 * An arrow function handed an own writable `prototype` (`shape/B2`).
 *
 * It answers the shape gate `true` while carrying no `[[Construct]]` slot at
 * all — outside the gate's stated precondition, which the entry never lets it
 * reach.
 *
 * @returns {Callable} the doctored arrow
 */
export const arrowWithGraftedPrototype = () => {
  const arrow = arrowFunction();

  defineProperty(arrow, 'prototype', {
    value: {
      /** @returns {string} a value, so the grafted prototype is not bare */
      identify() {
        return 'grafted';
      },
    },
    writable: true,
    enumerable: false,
    configurable: true,
  });

  return arrow;
};

/**
 * A constructor whose prototype's `constructor` slot is already sealed shut
 * (`define/R10`).
 *
 * @returns {NewableFunction} the constructor
 */
export const sealedConstructorSlotType = () => {
  const F = freshES3();

  defineProperty(prototypeOf(F), 'constructor', {
    value: F,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return F;
};

/**
 * A constructor whose prototype's own `Symbol.toStringTag` is already sealed
 * shut (`define/R11`).
 *
 * @returns {NewableFunction} the constructor
 */
export const sealedTagSlotType = () => {
  const F = freshES3();

  defineProperty(prototypeOf(F), Symbol.toStringTag, {
    value: 'Taken',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return F;
};

/** @returns {NewableFunction} a constructor whose prototype object is frozen */
export const frozenPrototypeType = () => {
  const F = freshES3();

  Object.freeze(prototypeOf(F));

  return F;
};

/**
 * A constructor whose prototype's `defineProperty` throws on its SECOND call
 * (`define/B7` — the partial-failure state).
 *
 * The tag lands, the `constructor` write is refused, and the constructor's own
 * `name` is never reached, `name` being written last.
 *
 * @returns {{ constructor: NewableFunction, state: { defines: number } }} the
 *  constructor and the define counter
 */
export const halfwayFailingType = () => {
  const state = { defines: 0 };
  const prototype = new Proxy(
    {
      /** @returns {string} a value, so the prototype is not bare */
      identify() {
        return 'halfway';
      },
    },
    {
      defineProperty(receiver, key, descriptor) {
        state.defines += 1;

        if (state.defines > 1) {
          throw new TypeError('the second define is refused');
        }

        return Reflect.defineProperty(receiver, key, descriptor);
      },
    },
  );

  return {
    constructor: /** @type {NewableFunction} */ (withOwnPrototype(freshES3(), prototype)),
    state,
  };
};

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identity Fixtures
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * A stable type-identity forged BY HAND — three `defineProperty` calls that
 * never went through this package (`carry/A4`).
 *
 * The point of the fixture is that the verification entry cannot tell the
 * difference, and says so: it reports that the shape is frozen, never that it
 * is authentic.
 *
 * @param {string} [identifier] - the name and tag to forge
 * @returns {NewableFunction} the forged constructor
 */
export const handForgedIdentity = (identifier = 'Forged') => {
  const C = freshClass();

  defineProperty(prototypeOf(C), Symbol.toStringTag, {
    get: () => identifier,
    enumerable: false,
    configurable: false,
  });
  defineProperty(prototypeOf(C), 'constructor', {
    value: C,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  defineProperty(C, 'name', {
    value: identifier,
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return C;
};

/**
 * A hand-forged identity whose tag getter THROWS when invoked, with the counter
 * that proves it was never invoked (`carry/B2`).
 *
 * @returns {{ constructor: NewableFunction, state: { invocations: number } }} the pair
 */
export const inertReadProbeType = () => {
  const state = { invocations: 0 };
  const C = freshClass();

  defineProperty(prototypeOf(C), Symbol.toStringTag, {
    get: () => {
      state.invocations += 1;

      throw new TypeError('the tag getter was invoked');
    },
    enumerable: false,
    configurable: false,
  });
  defineProperty(prototypeOf(C), 'constructor', {
    value: C,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  defineProperty(C, 'name', {
    value: 'Inert',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return { constructor: C, state };
};

/**
 * A hand-forged identity with ONE criterion left unfrozen, and a `Proxy` over it
 * that withholds that criterion's descriptor entirely (`carry/R9`).
 *
 * The pair is the vector. The honest half must answer `false` because the
 * unfrozen criterion genuinely fails; the withholding half must answer `false`
 * for the same reason, rather than `true` because there is no flag left to read.
 *
 * Which criterion can be withheld is not a free choice, and finding that out is
 * half the vector. A `Proxy` may only withdraw a descriptor the target holds
 * CONFIGURABLY — withdrawing a non-configurable one throws a proxy-invariant
 * `TypeError` — so the two are the same set: a slot loose enough to hide is a
 * slot loose enough to fail the criterion honestly. That is exactly why the
 * spoof was never reachable against a constructor this package had frozen, and
 * why it was reachable at all against one assembled by hand.
 *
 * @param {'name' | 'constructor'} unfrozen - the criterion left loose, then hidden
 * @returns {{ honest: NewableFunction, hidden: NewableFunction }} the pair
 */
export const descriptorWithholdingPair = (unfrozen) => {
  const honest = freshES3();
  const realPrototype = prototypeOf(honest);

  defineProperty(realPrototype, Symbol.toStringTag, {
    get: () => 'Honest',
    enumerable: false,
    configurable: false,
  });

  if (unfrozen === 'name') {
    // the prototype's `constructor` is frozen; `name` keeps the
    // `configurable: true` the language gave it, so it fails the criterion and
    // a trap may legally withdraw it
    defineProperty(realPrototype, 'constructor', {
      value: honest,
      writable: false,
      enumerable: false,
      configurable: false,
    });
  } else {
    // the mirror image: `name` is frozen and the prototype's `constructor` is
    // left at the language's default, which is writable AND configurable
    defineProperty(honest, 'name', {
      value: 'Honest',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  const withhold = (/** @type {PropertyKey} */ key) =>
    /** @type {ProxyHandler<object>} */ ({
      getOwnPropertyDescriptor: (target, probed) =>
        probed === key ? undefined : Reflect.getOwnPropertyDescriptor(target, probed),
    });

  const hidden =
    unfrozen === 'name'
      ? new Proxy(honest, withhold('name'))
      : // the prototype is swapped for a proxy of itself, which needs no
        // trickery on the constructor: an ES3 function's own `prototype` slot is
        // writable, so it simply takes the new value
        withOwnPrototype(freshES3(), new Proxy(realPrototype, withhold('constructor')));

  if (unfrozen === 'constructor') {
    defineProperty(hidden, 'name', {
      value: 'Honest',
      writable: false,
      enumerable: false,
      configurable: false,
    });
  }

  return {
    honest,
    hidden: /** @type {NewableFunction} */ (/** @type {unknown} */ (hidden)),
  };
};

/**
 * A forged identity whose prototype's `constructor` is an ACCESSOR rather than a
 * data property (`carry/R10`).
 *
 * Non-configurable and non-enumerable, so two of the three flags read as the
 * criterion wants — and an accessor carries no `[[Writable]]` attribute at all,
 * which is the one the criterion cannot do without.
 *
 * @returns {NewableFunction} the constructor
 */
export const accessorConstructorSlotType = () => {
  const F = freshES3();

  defineProperty(prototypeOf(F), Symbol.toStringTag, {
    get: () => 'Accessor',
    enumerable: false,
    configurable: false,
  });
  defineProperty(prototypeOf(F), 'constructor', {
    get: () => F,
    enumerable: false,
    configurable: false,
  });
  defineProperty(F, 'name', {
    value: 'Accessor',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return F;
};

/**
 * Runs a function with `Object.prototype` polluted by the three descriptor
 * flags, and restores it whatever happens (`carry/B7`).
 *
 * The pollution is what an object literal would inherit, so it is the input
 * that tells a prototype-less blank apart from a `{}`. Nothing but the callback
 * runs inside the window, and the restoration is asserted by the caller rather
 * than trusted — `Object.prototype` is the one fixture no test can make fresh.
 *
 * @template T
 * @param {() => T} run - the observation to make while polluted
 * @returns {T} whatever the callback answered
 */
export const withPollutedObjectPrototype = (run) => {
  const flags = ['writable', 'configurable', 'enumerable'];

  for (const flag of flags) {
    defineProperty(Object.prototype, flag, {
      value: false,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }

  try {
    return run();
  } finally {
    // `Reflect.deleteProperty` rather than `delete obj[key]`: the operator on a
    // computed key is what `no-dynamic-delete` refuses, and this is the one
    // place in the suite where the target cannot simply be thrown away and made
    // fresh. The restoration is asserted by the caller, not trusted.
    for (const flag of flags) {
      Reflect.deleteProperty(Object.prototype, flag);
    }
  }
};

/**
 * The three criteria, each dropped in turn, plus the three near-miss tag shapes
 * (`carry/B1`).
 *
 * Every entry produces a constructor carrying two of the three criteria, or all
 * three with the tag in a shape that does not qualify — so a `false` verdict
 * pins exactly which condition is load-bearing.
 *
 * @returns {Record<string, () => NewableFunction>} the named near-misses
 */
export const carryNearMisses = () => ({
  withoutTag: () => {
    const C = freshClass();

    defineProperty(prototypeOf(C), 'constructor', {
      value: C,
      writable: false,
      enumerable: false,
      configurable: false,
    });
    defineProperty(C, 'name', {
      value: 'Partial',
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return C;
  },
  withoutFrozenConstructor: () => {
    const C = freshClass();

    defineProperty(prototypeOf(C), Symbol.toStringTag, {
      get: () => 'Partial',
      enumerable: false,
      configurable: false,
    });
    defineProperty(C, 'name', {
      value: 'Partial',
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return C;
  },
  withoutFrozenName: () => {
    const C = freshClass();

    defineProperty(prototypeOf(C), Symbol.toStringTag, {
      get: () => 'Partial',
      enumerable: false,
      configurable: false,
    });
    defineProperty(prototypeOf(C), 'constructor', {
      value: C,
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return C;
  },
  enumerableTag: () => {
    const C = handForgedIdentityWithTagDescriptor({
      get: () => 'Partial',
      enumerable: true,
      configurable: false,
    });

    return C;
  },
  dataValuedTag: () => {
    const C = handForgedIdentityWithTagDescriptor({
      value: 'Partial',
      writable: false,
      enumerable: false,
      configurable: false,
    });

    return C;
  },
  getterAndSetterTag: () => {
    const C = handForgedIdentityWithTagDescriptor({
      get: () => 'Partial',
      set: () => undefined,
      enumerable: false,
      configurable: false,
    });

    return C;
  },
});

/**
 * The forging routine with the tag descriptor left to the caller, so the near-
 * miss tag shapes differ in exactly one descriptor field.
 *
 * @param {PropertyDescriptor} tagDescriptor - the descriptor to install for the tag
 * @returns {NewableFunction} the constructor
 */
function handForgedIdentityWithTagDescriptor(tagDescriptor) {
  const C = freshClass();

  defineProperty(prototypeOf(C), Symbol.toStringTag, tagDescriptor);
  defineProperty(prototypeOf(C), 'constructor', {
    value: C,
    writable: false,
    enumerable: false,
    configurable: false,
  });
  defineProperty(C, 'name', {
    value: 'Partial',
    writable: false,
    enumerable: false,
    configurable: false,
  });

  return C;
}

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Identifier Candidates
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {unknown} an instance of a `String` SUBCLASS — not a direct boxed `String` */
export const stringSubclassInstance = () => {
  class Sub extends String {
    /** @returns {string} a value, so the subclass carries a member */
    identify() {
      return 'sub';
    }
  }

  return new Sub('Foo');
};

/**
 * A `Proxy` over a boxed `String` whose every coercion path throws
 * (`ident/B1`).
 *
 * The type check refuses it before any coercion is attempted, which is what
 * keeps the freezing entries' "never throws" true against a hostile identifier.
 *
 * @returns {unknown} the proxy
 */
export const hostileBoxedString = () =>
  new Proxy(new String('Foo'), {
    get(target, key, receiver) {
      if (key === 'toString' || key === 'valueOf' || key === Symbol.toPrimitive) {
        return () => {
          throw new TypeError('every coercion path refuses');
        };
      }

      return /** @type {unknown} */ (Reflect.get(target, key, receiver));
    },
  });

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Error-Cause Seam
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/**
 * An `Error` constructor that IGNORES the options bag — the shape every engine
 * below ES2022 has, and the only way to reach the stand-in on an engine whose
 * native `Error` already honors `cause` (`cause/A2`).
 *
 * `name` is reassigned rather than the constructor being a bare `super` call,
 * which `no-useless-constructor` would refuse.
 */
export class IgnoringError extends Error {
  /** @param {string} [message] - the message, forwarded; anything else dropped */
  constructor(message) {
    super(message);

    this.name = 'IgnoringError';
  }
}

/**
 * An `Error` constructor that THROWS when probed (`cause/A3`).
 *
 * A throwing probe answers the capability question in the negative; letting it
 * escape would turn that question into a load error.
 */
export class ThrowingError extends Error {
  /** @param {string} [message] - the message, never used */
  constructor(message) {
    super(message);

    throw new TypeError('this constructor refuses to be probed');
  }
}

/**
 * The option bags `cause/B1` measures the stand-in's trigger against.
 *
 * `native` is what the ES2022 `Error` installs (`IsObject` plus `HasProperty`);
 * `standIn` is what this package's fallback installs (`isPlainObject` plus an
 * OWN key). Six rows diverge and two agree, and the two that agree are the
 * shapes the package actually produces.
 *
 * @returns {Record<string, { description: string, make: () => unknown, native: boolean, standIn: boolean }>} the bags
 */
export const causeOptionBags = () => ({
  objectLiteral: {
    description: 'an object literal — the shape every call site here builds',
    make: () => ({ cause: 'reason' }),
    native: true,
    standIn: true,
  },
  proxyOverLiteral: {
    description: 'a `Proxy` over an object literal',
    make: () => new Proxy({ cause: 'reason' }, {}),
    native: true,
    standIn: true,
  },
  prototypeLessBag: {
    description: 'a prototype-less dictionary',
    make: () => Object.assign(objectCreate(null), { cause: 'reason' }),
    native: true,
    standIn: false,
  },
  arrayBag: {
    description: 'an array carrying `cause`',
    make: () => Object.assign([], { cause: 'reason' }),
    native: true,
    standIn: false,
  },
  classInstanceBag: {
    description: 'a class instance carrying `cause`',
    make: () => {
      class Bag {
        /** @returns {string} a value, so the class carries a member */
        identify() {
          return 'bag';
        }
      }

      return Object.assign(new Bag(), { cause: 'reason' });
    },
    native: true,
    standIn: false,
  },
  inheritedCause: {
    description: 'an object inheriting `cause` rather than owning it',
    make: () => objectCreate({ cause: 'reason' }),
    native: true,
    standIn: false,
  },
  callableBag: {
    description: 'a callable carrying `cause`',
    make: () => Object.assign(() => undefined, { cause: 'reason' }),
    native: true,
    standIn: false,
  },
  boxedStringBag: {
    description: 'a boxed `String` carrying `cause`',
    make: () => Object.assign(new String('bag'), { cause: 'reason' }),
    native: true,
    standIn: false,
  },
});

// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----
//
//  Foreign-Realm Values
//
// ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- ----- -----

/** @returns {NewableFunction} a `class` constructor built in the shared foreign realm */
export const foreignClass = () =>
  /** @type {NewableFunction} */ (
    foreignRealmEval('(class Foreign { identify() { return "foreign"; } })')
  );

/** @returns {NewableFunction} an ES3 constructor built in the shared foreign realm */
export const foreignES3 = () =>
  /** @type {NewableFunction} */ (
    foreignRealmEval('(function Foreign() { return undefined; })')
  );

/** @returns {NewableFunction} the shared foreign realm's `Array` — a foreign built-in */
export const foreignBuiltin = () =>
  /** @type {NewableFunction} */ (foreignRealmEval('Array'));

/**
 * A PRIVATE realm holding a class under a global name, so this realm can freeze
 * it and that realm can then be asked what it sees (`realm/A1`).
 *
 * @returns {{ evaluate: (expression: string) => unknown, Foreign: NewableFunction }} the pair
 */
export const foreignRealmWithHeldClass = () => {
  const evaluate = createForeignRealm();

  evaluate('globalThis.Held = class Held { identify() { return "held"; } };');

  return {
    evaluate,
    Foreign: /** @type {NewableFunction} */ (evaluate('globalThis.Held')),
  };
};

/**
 * A PRIVATE realm and its `Math.max`, for the one vector whose effect is
 * permanent (`brand/B1`).
 *
 * @returns {{ evaluate: (expression: string) => unknown, maximum: Callable }} the pair
 */
export const foreignRealmWithBuiltinCallable = () => {
  const evaluate = createForeignRealm();

  return {
    evaluate,
    maximum: /** @type {Callable} */ (evaluate('Math.max')),
  };
};
