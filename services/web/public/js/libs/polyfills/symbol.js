define([], function() {
  /*!
   * Symbol-ES6 v0.1.2
   * ES6 Symbol polyfill in pure ES5.
   * 
   * OL MODIFICATIONS:
   * Added isImplemented function to conditionally polyfill only if Symbol isn't
   * supported. Taken from https://github.com/medikoo/es6-symbol
   *
   * @license Copyright (c) 2017-2018 Rousan Ali, MIT License
   *
   * Codebase: https://github.com/rousan/symbol-es6
   * Date: 28th Jan, 2018
   */

  (function (global, factory) {
    "use strict";

    if (typeof module === "object" && typeof module.exports === "object") {
      // For the environment like NodeJS, CommonJS etc where module or
      // module.exports objects are available
      module.exports = factory(global);
    } else {
      // For browser context, where global object is window
      factory(global);
    }

    /* window is for browser environment and global is for NodeJS environment */
  })(typeof window !== "undefined" ? window : global, function (global) {
    "use strict";

    function isImplemented() {
      var symbol;
      if (typeof Symbol !== 'function') return false;
      symbol = Symbol('test symbol');
      try { String(symbol); } catch (e) { return false; }

      var validTypes = { object: true, symbol: true };
      // Return 'true' also for polyfills
      if (!validTypes[typeof Symbol.iterator]) return false;
      if (!validTypes[typeof Symbol.toPrimitive]) return false;
      if (!validTypes[typeof Symbol.toStringTag]) return false;

      return true;
    };

    if (!isImplemented()) {
      !(function (global, factory) {
        "use strict";
        "object" == typeof module && "object" == typeof module.exports
          ? (module.exports = factory(global))
          : factory(global);
      })("undefined" != typeof window ? window : global, function (global) {
        "use strict";
        var defineProperty = Object.defineProperty,
          defineProperties = Object.defineProperties,
          symbolHiddenCounter = 0,
          globalSymbolRegistry = [],
          slice = Array.prototype.slice,
          ES6 = "object" == typeof global.ES6 ? global.ES6 : (global.ES6 = {}),
          isArray = Array.isArray,
          objectToString = Object.prototype.toString,
          push = Array.prototype.push,
          emptyFunction = function () { },
          simpleFunction = function (arg) {
            return arg;
          },
          isCallable = function (fn) {
            return "function" == typeof fn;
          },
          Iterator = function () { },
          ArrayIterator = function (array, flag) {
            (this._array = array), (this._flag = flag), (this._nextIndex = 0);
          },
          StringIterator = function (string, flag) {
            (this._string = string), (this._flag = flag), (this._nextIndex = 0);
          },
          isObject = function (value) {
            return (
              null !== value &&
              ("object" == typeof value || "function" == typeof value)
            );
          },
          setupSymbolInternals = function (symbol, desc) {
            return (
              defineProperties(symbol, {
                _description: { value: desc },
                _isSymbol: { value: !0 },
                _id: { value: symbolHiddenCounter++ }
              }),
              symbol
            );
          },
          appendArray = function (array1, array2) {
            if (
              "number" == typeof array1.length &&
              array1.length >= 0 &&
              "number" == typeof array2.length &&
              array2.length >= 0
            ) {
              var length1 = Math.floor(array1.length),
                length2 = Math.floor(array2.length),
                i = 0;
              for (array1.length = length1 + length2; i < length2; ++i)
                array2.hasOwnProperty(i) && (array1[length1 + i] = array2[i]);
            }
          },
          simpleInheritance = function (child, parent) {
            if ("function" != typeof child || "function" != typeof parent)
              throw new TypeError("Child and Parent must be function type");
            (child.prototype = Object.create(parent.prototype)),
              (child.prototype.constructor = child);
          },
          Symbol = function Symbol(desc) {
            if (
              ((desc = void 0 === desc ? "" : String(desc)), this instanceof Symbol)
            )
              throw new TypeError("Symbol is not a constructor");
            return setupSymbolInternals(Object.create(Symbol.prototype), desc);
          };
        defineProperties(Symbol, {
          for: {
            value: function (key) {
              key = String(key);
              for (
                var record, registryLength = globalSymbolRegistry.length, i = 0;
                i < registryLength;
                ++i
              )
                if ((record = globalSymbolRegistry[i]).key === key)
                  return record.symbol;
              return (
                (record = { key: key, symbol: Symbol(key) }),
                globalSymbolRegistry.push(record),
                record.symbol
              );
            },
            writable: !0,
            configurable: !0
          },
          keyFor: {
            value: function (symbol) {
              if (!ES6.isSymbol(symbol))
                throw new TypeError(String(symbol) + " is not a symbol");
              for (
                var record, registryLength = globalSymbolRegistry.length, i = 0;
                i < registryLength;
                ++i
              )
                if ((record = globalSymbolRegistry[i]).symbol === symbol)
                  return record.key;
            },
            writable: !0,
            configurable: !0
          },
          hasInstance: { value: Symbol("Symbol.hasInstance") },
          isConcatSpreadable: { value: Symbol("Symbol.isConcatSpreadable") },
          iterator: { value: Symbol("Symbol.iterator") },
          toStringTag: { value: Symbol("Symbol.toStringTag") }
        }),
          (Symbol.prototype.toString = function () {
            return "@@_____" + this._id + "_____";
          }),
          (Symbol.prototype.valueOf = function () {
            return this;
          }),
          defineProperty(Iterator.prototype, Symbol.iterator.toString(), {
            value: function () {
              return this;
            },
            writable: !0,
            configurable: !0
          }),
          simpleInheritance(ArrayIterator, Iterator),
          simpleInheritance(StringIterator, Iterator),
          defineProperty(ArrayIterator.prototype, Symbol.toStringTag.toString(), {
            value: "Array Iterator",
            configurable: !0
          }),
          defineProperty(StringIterator.prototype, Symbol.toStringTag.toString(), {
            value: "String Iterator",
            configurable: !0
          }),
          (ArrayIterator.prototype.next = function () {
            if (!(this instanceof ArrayIterator))
              throw new TypeError(
                "Method Array Iterator.prototype.next called on incompatible receiver " +
                String(this)
              );
            var nextValue;
            return -1 === this._nextIndex
              ? { done: !0, value: void 0 }
              : "number" == typeof this._array.length &&
                this._array.length >= 0 &&
                this._nextIndex < Math.floor(this._array.length)
                ? (1 === this._flag
                  ? (nextValue = [this._nextIndex, this._array[this._nextIndex]])
                  : 2 === this._flag
                    ? (nextValue = this._array[this._nextIndex])
                    : 3 === this._flag && (nextValue = this._nextIndex),
                  this._nextIndex++ ,
                  { done: !1, value: nextValue })
                : ((this._nextIndex = -1), { done: !0, value: void 0 });
          }),
          (StringIterator.prototype.next = function () {
            if (!(this instanceof StringIterator))
              throw new TypeError(
                "Method String Iterator.prototype.next called on incompatible receiver " +
                String(this)
              );
            var nextValue,
              stringObject = new String(this._string);
            return -1 === this._nextIndex
              ? { done: !0, value: void 0 }
              : this._nextIndex < stringObject.length
                ? ((nextValue = stringObject[this._nextIndex]),
                  this._nextIndex++ ,
                  { done: !1, value: nextValue })
                : ((this._nextIndex = -1), { done: !0, value: void 0 });
          });
        var SpreadOperatorImpl = function (target, thisArg) {
          (this._target = target), (this._values = []), (this._thisArg = thisArg);
        };
        (SpreadOperatorImpl.prototype.spread = function () {
          var self = this;
          return (
            slice.call(arguments).forEach(function (iterable) {
              ES6.forOf(iterable, function (value) {
                self._values.push(value);
              });
            }),
            self
          );
        }),
          (SpreadOperatorImpl.prototype.add = function () {
            var self = this;
            return (
              slice.call(arguments).forEach(function (value) {
                self._values.push(value);
              }),
              self
            );
          }),
          (SpreadOperatorImpl.prototype.call = function (thisArg) {
            if ("function" != typeof this._target)
              throw new TypeError("Target is not a function");
            return (
              (thisArg = arguments.length <= 0 ? this._thisArg : thisArg),
              this._target.apply(thisArg, this._values)
            );
          }),
          (SpreadOperatorImpl.prototype.new = function () {
            if ("function" != typeof this._target)
              throw new TypeError("Target is not a constructor");
            var temp, returnValue;
            return (
              (temp = Object.create(this._target.prototype)),
              (returnValue = this._target.apply(temp, this._values)),
              isObject(returnValue) ? returnValue : temp
            );
          }),
          (SpreadOperatorImpl.prototype.array = function () {
            if (!isArray(this._target)) throw new TypeError("Target is not a array");
            return push.apply(this._target, this._values), this._target;
          });
        return (
          defineProperties(ES6, {
            isSymbol: {
              value: function (symbol) {
                return (
                  symbol instanceof Symbol &&
                  (function (symbol) {
                    return (
                      !0 === symbol._isSymbol &&
                      "number" == typeof symbol._id &&
                      "string" == typeof symbol._description
                    );
                  })(symbol)
                );
              },
              writable: !0,
              configurable: !0
            },
            instanceOf: {
              value: function (object, constructor) {
                if (!isObject(constructor))
                  throw new TypeError(
                    "Right-hand side of 'instanceof' is not an object"
                  );
                var hasInstanceSymbolProp = constructor[Symbol.hasInstance];
                if (void 0 === hasInstanceSymbolProp)
                  return object instanceof constructor;
                if ("function" != typeof hasInstanceSymbolProp)
                  throw new TypeError(
                    typeof hasInstanceSymbolProp + " is not a function"
                  );
                return hasInstanceSymbolProp.call(constructor, object);
              },
              writable: !0,
              configurable: !0
            },
            forOf: {
              value: function (iterable, callback, thisArg) {
                if (
                  ((callback =
                    "function" != typeof callback ? emptyFunction : callback),
                    "function" != typeof iterable[Symbol.iterator])
                )
                  throw new TypeError("Iterable[Symbol.iterator] is not a function");
                var iterationResult,
                  iterator = iterable[Symbol.iterator]();
                if ("function" != typeof iterator.next)
                  throw new TypeError(".iterator.next is not a function");
                for (; ;) {
                  if (
                    ((iterationResult = iterator.next()), !isObject(iterationResult))
                  )
                    throw new TypeError(
                      "Iterator result " + iterationResult + " is not an object"
                    );
                  if (iterationResult.done) break;
                  callback.call(thisArg, iterationResult.value);
                }
              },
              writable: !0,
              configurable: !0
            },
            spreadOperator: {
              value: function (target, thisArg) {
                if ("function" != typeof target && !isArray(target))
                  throw new TypeError(
                    "Spread operator only supports on array and function objects at this moment"
                  );
                return new SpreadOperatorImpl(target, thisArg);
              },
              writable: !0,
              configurable: !0
            }
          }),
          defineProperty(global, "Symbol", {
            value: Symbol,
            writable: !0,
            configurable: !0
          }),
          defineProperty(Function.prototype, Symbol.hasInstance.toString(), {
            value: function (instance) {
              return "function" == typeof this && instance instanceof this;
            }
          }),
          defineProperty(Array.prototype, "concat", {
            value: function () {
              if (void 0 === this || null === this)
                throw new TypeError(
                  "Array.prototype.concat called on null or undefined"
                );
              var self = Object(this),
                targets = slice.call(arguments),
                outputs = [];
              return (
                targets.unshift(self),
                targets.forEach(function (target) {
                  isObject(target)
                    ? void 0 !== target[Symbol.isConcatSpreadable]
                      ? target[Symbol.isConcatSpreadable]
                        ? appendArray(outputs, target)
                        : outputs.push(target)
                      : isArray(target)
                        ? appendArray(outputs, target)
                        : outputs.push(target)
                    : outputs.push(target);
                }),
                outputs
              );
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(Object.prototype, "toString", {
            value: function () {
              return void 0 === this || null === this
                ? objectToString.call(this)
                : "string" == typeof this[Symbol.toStringTag]
                  ? "[object " + this[Symbol.toStringTag] + "]"
                  : objectToString.call(this);
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(Array.prototype, Symbol.iterator.toString(), {
            value: function () {
              if (void 0 === this || null === this)
                throw new TypeError("Cannot convert undefined or null to object");
              var self = Object(this);
              return new ArrayIterator(self, 2);
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(Array, "from", {
            value: function (arrayLike, mapFn, thisArg) {
              var constructor,
                length,
                outputs,
                i = 0;
              if (
                ((constructor = isCallable(this) ? this : Array),
                  void 0 === arrayLike || null === arrayLike)
              )
                throw new TypeError("Cannot convert undefined or null to object");
              if (((arrayLike = Object(arrayLike)), void 0 === mapFn))
                mapFn = simpleFunction;
              else if (!isCallable(mapFn))
                throw new TypeError(mapFn + " is not a function");
              if (void 0 === arrayLike[Symbol.iterator]) {
                if (!("number" == typeof arrayLike.length && arrayLike.length >= 0))
                  return ((outputs = new constructor(0)).length = 0), outputs;
                for (
                  length = Math.floor(arrayLike.length),
                  (outputs = new constructor(length)).length = length;
                  i < length;
                  ++i
                )
                  outputs[i] = mapFn.call(thisArg, arrayLike[i]);
              } else
                ((outputs = new constructor()).length = 0),
                  ES6.forOf(arrayLike, function (value) {
                    outputs.length++ ,
                      (outputs[outputs.length - 1] = mapFn.call(thisArg, value));
                  });
              return outputs;
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(Array.prototype, "entries", {
            value: function () {
              if (void 0 === this || null === this)
                throw new TypeError("Cannot convert undefined or null to object");
              var self = Object(this);
              return new ArrayIterator(self, 1);
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(Array.prototype, "keys", {
            value: function () {
              if (void 0 === this || null === this)
                throw new TypeError("Cannot convert undefined or null to object");
              var self = Object(this);
              return new ArrayIterator(self, 3);
            },
            writable: !0,
            configurable: !0
          }),
          defineProperty(String.prototype, Symbol.iterator.toString(), {
            value: function () {
              if (void 0 === this || null === this)
                throw new TypeError(
                  "String.prototype[Symbol.iterator] called on null or undefined"
                );
              return new StringIterator(String(this), 0);
            },
            writable: !0,
            configurable: !0
          }),
          ES6
        );
      });
    }
  });
});
