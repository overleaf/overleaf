;(function(){

/**
 * Require the given path.
 *
 * @param {String} path
 * @return {Object} exports
 * @api public
 */

function require(path, parent, orig) {
  var resolved = require.resolve(path);

  // lookup failed
  if (null == resolved) {
    orig = orig || path;
    parent = parent || 'root';
    var err = new Error('Failed to require "' + orig + '" from "' + parent + '"');
    err.path = orig;
    err.parent = parent;
    err.require = true;
    throw err;
  }

  var module = require.modules[resolved];

  // perform real require()
  // by invoking the module's
  // registered function
  if (!module._resolving && !module.exports) {
    var mod = {};
    mod.exports = {};
    mod.client = mod.component = true;
    module._resolving = true;
    module.call(this, mod.exports, require.relative(resolved), mod);
    delete module._resolving;
    module.exports = mod.exports;
  }

  return module.exports;
}

/**
 * Registered modules.
 */

require.modules = {};

/**
 * Registered aliases.
 */

require.aliases = {};

/**
 * Resolve `path`.
 *
 * Lookup:
 *
 *   - PATH/index.js
 *   - PATH.js
 *   - PATH
 *
 * @param {String} path
 * @return {String} path or null
 * @api private
 */

require.resolve = function(path) {
  if (path.charAt(0) === '/') path = path.slice(1);

  var paths = [
    path,
    path + '.js',
    path + '.json',
    path + '/index.js',
    path + '/index.json'
  ];

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i];
    if (require.modules.hasOwnProperty(path)) return path;
    if (require.aliases.hasOwnProperty(path)) return require.aliases[path];
  }
};

/**
 * Normalize `path` relative to the current path.
 *
 * @param {String} curr
 * @param {String} path
 * @return {String}
 * @api private
 */

require.normalize = function(curr, path) {
  var segs = [];

  if ('.' != path.charAt(0)) return path;

  curr = curr.split('/');
  path = path.split('/');

  for (var i = 0; i < path.length; ++i) {
    if ('..' == path[i]) {
      curr.pop();
    } else if ('.' != path[i] && '' != path[i]) {
      segs.push(path[i]);
    }
  }

  return curr.concat(segs).join('/');
};

/**
 * Register module at `path` with callback `definition`.
 *
 * @param {String} path
 * @param {Function} definition
 * @api private
 */

require.register = function(path, definition) {
  require.modules[path] = definition;
};

/**
 * Alias a module definition.
 *
 * @param {String} from
 * @param {String} to
 * @api private
 */

require.alias = function(from, to) {
  if (!require.modules.hasOwnProperty(from)) {
    throw new Error('Failed to alias "' + from + '", it does not exist');
  }
  require.aliases[to] = from;
};

/**
 * Return a require function relative to the `parent` path.
 *
 * @param {String} parent
 * @return {Function}
 * @api private
 */

require.relative = function(parent) {
  var p = require.normalize(parent, '..');

  /**
   * lastIndexOf helper.
   */

  function lastIndexOf(arr, obj) {
    var i = arr.length;
    while (i--) {
      if (arr[i] === obj) return i;
    }
    return -1;
  }

  /**
   * The relative require() itself.
   */

  function localRequire(path) {
    var resolved = localRequire.resolve(path);
    return require(resolved, parent, path);
  }

  /**
   * Resolve relative to the parent.
   */

  localRequire.resolve = function(path) {
    var c = path.charAt(0);
    if ('/' == c) return path.slice(1);
    if ('.' == c) return require.normalize(p, path);

    // resolve deps by returning
    // the dep in the nearest "deps"
    // directory
    var segs = parent.split('/');
    var i = lastIndexOf(segs, 'deps') + 1;
    if (!i) i = 0;
    path = segs.slice(0, i + 1).join('/') + '/deps/' + path;
    return path;
  };

  /**
   * Check if module is defined at `path`.
   */

  localRequire.exists = function(path) {
    return require.modules.hasOwnProperty(localRequire.resolve(path));
  };

  return localRequire;
};
require.register("visionmedia-node-querystring/index.js", function(exports, require, module){
/**
 * Object#toString() ref for stringify().
 */

var toString = Object.prototype.toString;

/**
 * Object#hasOwnProperty ref
 */

var hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * Array#indexOf shim.
 */

var indexOf = typeof Array.prototype.indexOf === 'function'
  ? function(arr, el) { return arr.indexOf(el); }
  : function(arr, el) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i] === el) return i;
      }
      return -1;
    };

/**
 * Array.isArray shim.
 */

var isArray = Array.isArray || function(arr) {
  return toString.call(arr) == '[object Array]';
};

/**
 * Object.keys shim.
 */

var objectKeys = Object.keys || function(obj) {
  var ret = [];
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      ret.push(key);
    }
  }
  return ret;
};

/**
 * Array#forEach shim.
 */

var forEach = typeof Array.prototype.forEach === 'function'
  ? function(arr, fn) { return arr.forEach(fn); }
  : function(arr, fn) {
      for (var i = 0; i < arr.length; i++) fn(arr[i]);
    };

/**
 * Array#reduce shim.
 */

var reduce = function(arr, fn, initial) {
  if (typeof arr.reduce === 'function') return arr.reduce(fn, initial);
  var res = initial;
  for (var i = 0; i < arr.length; i++) res = fn(res, arr[i]);
  return res;
};

/**
 * Cache non-integer test regexp.
 */

var isint = /^[0-9]+$/;

function promote(parent, key) {
  if (parent[key].length == 0) return parent[key] = {}
  var t = {};
  for (var i in parent[key]) {
    if (hasOwnProperty.call(parent[key], i)) {
      t[i] = parent[key][i];
    }
  }
  parent[key] = t;
  return t;
}

function parse(parts, parent, key, val) {
  var part = parts.shift();
  
  // illegal
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  
  // end
  if (!part) {
    if (isArray(parent[key])) {
      parent[key].push(val);
    } else if ('object' == typeof parent[key]) {
      parent[key] = val;
    } else if ('undefined' == typeof parent[key]) {
      parent[key] = val;
    } else {
      parent[key] = [parent[key], val];
    }
    // array
  } else {
    var obj = parent[key] = parent[key] || [];
    if (']' == part) {
      if (isArray(obj)) {
        if ('' != val) obj.push(val);
      } else if ('object' == typeof obj) {
        obj[objectKeys(obj).length] = val;
      } else {
        obj = parent[key] = [parent[key], val];
      }
      // prop
    } else if (~indexOf(part, ']')) {
      part = part.substr(0, part.length - 1);
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
      // key
    } else {
      if (!isint.test(part) && isArray(obj)) obj = promote(parent, key);
      parse(parts, obj, part, val);
    }
  }
}

/**
 * Merge parent key/val pair.
 */

function merge(parent, key, val){
  if (~indexOf(key, ']')) {
    var parts = key.split('[')
      , len = parts.length
      , last = len - 1;
    parse(parts, parent, 'base', val);
    // optimize
  } else {
    if (!isint.test(key) && isArray(parent.base)) {
      var t = {};
      for (var k in parent.base) t[k] = parent.base[k];
      parent.base = t;
    }
    set(parent.base, key, val);
  }

  return parent;
}

/**
 * Compact sparse arrays.
 */

function compact(obj) {
  if ('object' != typeof obj) return obj;

  if (isArray(obj)) {
    var ret = [];

    for (var i in obj) {
      if (hasOwnProperty.call(obj, i)) {
        ret.push(obj[i]);
      }
    }

    return ret;
  }

  for (var key in obj) {
    obj[key] = compact(obj[key]);
  }

  return obj;
}

/**
 * Parse the given obj.
 */

function parseObject(obj){
  var ret = { base: {} };

  forEach(objectKeys(obj), function(name){
    merge(ret, name, obj[name]);
  });

  return compact(ret.base);
}

/**
 * Parse the given str.
 */

function parseString(str){
  var ret = reduce(String(str).split('&'), function(ret, pair){
    var eql = indexOf(pair, '=')
      , brace = lastBraceInKey(pair)
      , key = pair.substr(0, brace || eql)
      , val = pair.substr(brace || eql, pair.length)
      , val = val.substr(indexOf(val, '=') + 1, val.length);

    // ?foo
    if ('' == key) key = pair, val = '';
    if ('' == key) return ret;

    return merge(ret, decode(key), decode(val));
  }, { base: {} }).base;

  return compact(ret);
}

/**
 * Parse the given query `str` or `obj`, returning an object.
 *
 * @param {String} str | {Object} obj
 * @return {Object}
 * @api public
 */

exports.parse = function(str){
  if (null == str || '' == str) return {};
  return 'object' == typeof str
    ? parseObject(str)
    : parseString(str);
};

/**
 * Turn the given `obj` into a query string
 *
 * @param {Object} obj
 * @return {String}
 * @api public
 */

var stringify = exports.stringify = function(obj, prefix) {
  if (isArray(obj)) {
    return stringifyArray(obj, prefix);
  } else if ('[object Object]' == toString.call(obj)) {
    return stringifyObject(obj, prefix);
  } else if ('string' == typeof obj) {
    return stringifyString(obj, prefix);
  } else {
    return prefix + '=' + encodeURIComponent(String(obj));
  }
};

/**
 * Stringify the given `str`.
 *
 * @param {String} str
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyString(str, prefix) {
  if (!prefix) throw new TypeError('stringify expects an object');
  return prefix + '=' + encodeURIComponent(str);
}

/**
 * Stringify the given `arr`.
 *
 * @param {Array} arr
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyArray(arr, prefix) {
  var ret = [];
  if (!prefix) throw new TypeError('stringify expects an object');
  for (var i = 0; i < arr.length; i++) {
    ret.push(stringify(arr[i], prefix + '[' + i + ']'));
  }
  return ret.join('&');
}

/**
 * Stringify the given `obj`.
 *
 * @param {Object} obj
 * @param {String} prefix
 * @return {String}
 * @api private
 */

function stringifyObject(obj, prefix) {
  var ret = []
    , keys = objectKeys(obj)
    , key;

  for (var i = 0, len = keys.length; i < len; ++i) {
    key = keys[i];
    if ('' == key) continue;
    if (null == obj[key]) {
      ret.push(encodeURIComponent(key) + '=');
    } else {
      ret.push(stringify(obj[key], prefix
        ? prefix + '[' + encodeURIComponent(key) + ']'
        : encodeURIComponent(key)));
    }
  }

  return ret.join('&');
}

/**
 * Set `obj`'s `key` to `val` respecting
 * the weird and wonderful syntax of a qs,
 * where "foo=bar&foo=baz" becomes an array.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {String} val
 * @api private
 */

function set(obj, key, val) {
  var v = obj[key];
  if (Object.getOwnPropertyDescriptor(Object.prototype, key)) return;
  if (undefined === v) {
    obj[key] = val;
  } else if (isArray(v)) {
    v.push(val);
  } else {
    obj[key] = [v, val];
  }
}

/**
 * Locate last brace in `str` within the key.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */

function lastBraceInKey(str) {
  var len = str.length
    , brace
    , c;
  for (var i = 0; i < len; ++i) {
    c = str[i];
    if (']' == c) brace = false;
    if ('[' == c) brace = true;
    if ('=' == c && !brace) return i;
  }
}

/**
 * Decode `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function decode(str) {
  try {
    return decodeURIComponent(str.replace(/\+/g, ' '));
  } catch (err) {
    return str;
  }
}

});
require.register("component-emitter/index.js", function(exports, require, module){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

});
require.register("component-indexof/index.js", function(exports, require, module){
module.exports = function(arr, obj){
  if (arr.indexOf) return arr.indexOf(obj);
  for (var i = 0; i < arr.length; ++i) {
    if (arr[i] === obj) return i;
  }
  return -1;
};
});
require.register("component-object/index.js", function(exports, require, module){

/**
 * HOP ref.
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Return own keys in `obj`.
 *
 * @param {Object} obj
 * @return {Array}
 * @api public
 */

exports.keys = Object.keys || function(obj){
  var keys = [];
  for (var key in obj) {
    if (has.call(obj, key)) {
      keys.push(key);
    }
  }
  return keys;
};

/**
 * Return own values in `obj`.
 *
 * @param {Object} obj
 * @return {Array}
 * @api public
 */

exports.values = function(obj){
  var vals = [];
  for (var key in obj) {
    if (has.call(obj, key)) {
      vals.push(obj[key]);
    }
  }
  return vals;
};

/**
 * Merge `b` into `a`.
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object} a
 * @api public
 */

exports.merge = function(a, b){
  for (var key in b) {
    if (has.call(b, key)) {
      a[key] = b[key];
    }
  }
  return a;
};

/**
 * Return length of `obj`.
 *
 * @param {Object} obj
 * @return {Number}
 * @api public
 */

exports.length = function(obj){
  return exports.keys(obj).length;
};

/**
 * Check if `obj` is empty.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api public
 */

exports.isEmpty = function(obj){
  return 0 == exports.length(obj);
};
});
require.register("component-event/index.js", function(exports, require, module){
var bind = window.addEventListener ? 'addEventListener' : 'attachEvent',
    unbind = window.removeEventListener ? 'removeEventListener' : 'detachEvent',
    prefix = bind !== 'addEventListener' ? 'on' : '';

/**
 * Bind `el` event `type` to `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.bind = function(el, type, fn, capture){
  el[bind](prefix + type, fn, capture || false);
  return fn;
};

/**
 * Unbind `el` event `type`'s callback `fn`.
 *
 * @param {Element} el
 * @param {String} type
 * @param {Function} fn
 * @param {Boolean} capture
 * @return {Function}
 * @api public
 */

exports.unbind = function(el, type, fn, capture){
  el[unbind](prefix + type, fn, capture || false);
  return fn;
};
});
require.register("component-clone/index.js", function(exports, require, module){
/**
 * Module dependencies.
 */

var type;
try {
  type = require('component-type');
} catch (_) {
  type = require('type');
}

/**
 * Module exports.
 */

module.exports = clone;

/**
 * Clones objects.
 *
 * @param {Mixed} any object
 * @api public
 */

function clone(obj){
  switch (type(obj)) {
    case 'object':
      var copy = {};
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          copy[key] = clone(obj[key]);
        }
      }
      return copy;

    case 'array':
      var copy = new Array(obj.length);
      for (var i = 0, l = obj.length; i < l; i++) {
        copy[i] = clone(obj[i]);
      }
      return copy;

    case 'regexp':
      // from millermedeiros/amd-utils - MIT
      var flags = '';
      flags += obj.multiline ? 'm' : '';
      flags += obj.global ? 'g' : '';
      flags += obj.ignoreCase ? 'i' : '';
      return new RegExp(obj.source, flags);

    case 'date':
      return new Date(obj.getTime());

    default: // string, number, boolean, …
      return obj;
  }
}

});
require.register("component-bind/index.js", function(exports, require, module){

/**
 * Slice reference.
 */

var slice = [].slice;

/**
 * Bind `obj` to `fn`.
 *
 * @param {Object} obj
 * @param {Function|String} fn or string
 * @return {Function}
 * @api public
 */

module.exports = function(obj, fn){
  if ('string' == typeof fn) fn = obj[fn];
  if ('function' != typeof fn) throw new Error('bind() requires a function');
  var args = [].slice.call(arguments, 2);
  return function(){
    return fn.apply(obj, args.concat(slice.call(arguments)));
  }
};

});
require.register("component-props/index.js", function(exports, require, module){
/**
 * Global Names
 */

var globals = /\b(this|Array|Date|Object|Math|JSON)\b/g;

/**
 * Return immediate identifiers parsed from `str`.
 *
 * @param {String} str
 * @param {String|Function} map function or prefix
 * @return {Array}
 * @api public
 */

module.exports = function(str, fn){
  var p = unique(props(str));
  if (fn && 'string' == typeof fn) fn = prefixed(fn);
  if (fn) return map(str, p, fn);
  return p;
};

/**
 * Return immediate identifiers in `str`.
 *
 * @param {String} str
 * @return {Array}
 * @api private
 */

function props(str) {
  return str
    .replace(/\.\w+|\w+ *\(|"[^"]*"|'[^']*'|\/([^/]+)\//g, '')
    .replace(globals, '')
    .match(/[$a-zA-Z_]\w*/g)
    || [];
}

/**
 * Return `str` with `props` mapped with `fn`.
 *
 * @param {String} str
 * @param {Array} props
 * @param {Function} fn
 * @return {String}
 * @api private
 */

function map(str, props, fn) {
  var re = /\.\w+|\w+ *\(|"[^"]*"|'[^']*'|\/([^/]+)\/|[a-zA-Z_]\w*/g;
  return str.replace(re, function(_){
    if ('(' == _[_.length - 1]) return fn(_);
    if (!~props.indexOf(_)) return _;
    return fn(_);
  });
}

/**
 * Return unique array.
 *
 * @param {Array} arr
 * @return {Array}
 * @api private
 */

function unique(arr) {
  var ret = [];

  for (var i = 0; i < arr.length; i++) {
    if (~ret.indexOf(arr[i])) continue;
    ret.push(arr[i]);
  }

  return ret;
}

/**
 * Map with prefix `str`.
 */

function prefixed(str) {
  return function(_){
    return str + _;
  };
}

});
require.register("component-to-function/index.js", function(exports, require, module){
/**
 * Module Dependencies
 */

var expr = require('props');

/**
 * Expose `toFunction()`.
 */

module.exports = toFunction;

/**
 * Convert `obj` to a `Function`.
 *
 * @param {Mixed} obj
 * @return {Function}
 * @api private
 */

function toFunction(obj) {
  switch ({}.toString.call(obj)) {
    case '[object Object]':
      return objectToFunction(obj);
    case '[object Function]':
      return obj;
    case '[object String]':
      return stringToFunction(obj);
    case '[object RegExp]':
      return regexpToFunction(obj);
    default:
      return defaultToFunction(obj);
  }
}

/**
 * Default to strict equality.
 *
 * @param {Mixed} val
 * @return {Function}
 * @api private
 */

function defaultToFunction(val) {
  return function(obj){
    return val === obj;
  }
}

/**
 * Convert `re` to a function.
 *
 * @param {RegExp} re
 * @return {Function}
 * @api private
 */

function regexpToFunction(re) {
  return function(obj){
    return re.test(obj);
  }
}

/**
 * Convert property `str` to a function.
 *
 * @param {String} str
 * @return {Function}
 * @api private
 */

function stringToFunction(str) {
  // immediate such as "> 20"
  if (/^ *\W+/.test(str)) return new Function('_', 'return _ ' + str);

  // properties such as "name.first" or "age > 18" or "age > 18 && age < 36"
  return new Function('_', 'return ' + get(str));
}

/**
 * Convert `object` to a function.
 *
 * @param {Object} object
 * @return {Function}
 * @api private
 */

function objectToFunction(obj) {
  var match = {}
  for (var key in obj) {
    match[key] = typeof obj[key] === 'string'
      ? defaultToFunction(obj[key])
      : toFunction(obj[key])
  }
  return function(val){
    if (typeof val !== 'object') return false;
    for (var key in match) {
      if (!(key in val)) return false;
      if (!match[key](val[key])) return false;
    }
    return true;
  }
}

/**
 * Built the getter function. Supports getter style functions
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function get(str) {
  var props = expr(str);
  if (!props.length) return '_.' + str;

  var val;
  for(var i = 0, prop; prop = props[i]; i++) {
    val = '_.' + prop;
    val = "('function' == typeof " + val + " ? " + val + "() : " + val + ")";
    str = str.replace(new RegExp(prop, 'g'), val);
  }

  return str;
}

});
require.register("component-each/index.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var type = require('type');
var toFunction = require('to-function');

/**
 * HOP reference.
 */

var has = Object.prototype.hasOwnProperty;

/**
 * Iterate the given `obj` and invoke `fn(val, i)`
 * in optional context `ctx`.
 *
 * @param {String|Array|Object} obj
 * @param {Function} fn
 * @param {Object} [ctx]
 * @api public
 */

module.exports = function(obj, fn, ctx){
  fn = toFunction(fn);
  ctx = ctx || this;
  switch (type(obj)) {
    case 'array':
      return array(obj, fn, ctx);
    case 'object':
      if ('number' == typeof obj.length) return array(obj, fn, ctx);
      return object(obj, fn, ctx);
    case 'string':
      return string(obj, fn, ctx);
  }
};

/**
 * Iterate string chars.
 *
 * @param {String} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function string(obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj.charAt(i), i);
  }
}

/**
 * Iterate object keys.
 *
 * @param {Object} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function object(obj, fn, ctx) {
  for (var key in obj) {
    if (has.call(obj, key)) {
      fn.call(ctx, key, obj[key]);
    }
  }
}

/**
 * Iterate array-ish.
 *
 * @param {Array|Object} obj
 * @param {Function} fn
 * @param {Object} ctx
 * @api private
 */

function array(obj, fn, ctx) {
  for (var i = 0; i < obj.length; ++i) {
    fn.call(ctx, obj[i], i);
  }
}

});
require.register("component-find/index.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var toFunction = require('to-function');

/**
 * Find the first value in `arr` with when `fn(val, i)` is truthy.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @return {Array}
 * @api public
 */

module.exports = function(arr, fn){
  // callback
  if ('function' != typeof fn) {
    if (Object(fn) === fn) fn = objectToFunction(fn);
    else fn = toFunction(fn);
  }

  // filter
  for (var i = 0, len = arr.length; i < len; ++i) {
    if (fn(arr[i], i)) return arr[i];
  }
};

/**
 * Convert `obj` into a match function.
 *
 * @param {Object} obj
 * @return {Function}
 * @api private
 */

function objectToFunction(obj) {
  return function(o){
    for (var key in obj) {
      if (o[key] != obj[key]) return false;
    }
    return true;
  }
}
});
require.register("component-json/index.js", function(exports, require, module){

module.exports = 'undefined' == typeof JSON
  ? require('component-json-fallback')
  : JSON;

});
require.register("component-type/index.js", function(exports, require, module){

/**
 * toString ref.
 */

var toString = Object.prototype.toString;

/**
 * Return the type of `val`.
 *
 * @param {Mixed} val
 * @return {String}
 * @api public
 */

module.exports = function(val){
  switch (toString.call(val)) {
    case '[object Function]': return 'function';
    case '[object Date]': return 'date';
    case '[object RegExp]': return 'regexp';
    case '[object Arguments]': return 'arguments';
    case '[object Array]': return 'array';
    case '[object String]': return 'string';
  }

  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (val && val.nodeType === 1) return 'element';
  if (val === Object(val)) return 'object';

  return typeof val;
};

});
require.register("component-trim/index.js", function(exports, require, module){

exports = module.exports = trim;

function trim(str){
  if (str.trim) return str.trim();
  return str.replace(/^\s*|\s*$/g, '');
}

exports.left = function(str){
  if (str.trimLeft) return str.trimLeft();
  return str.replace(/^\s*/, '');
};

exports.right = function(str){
  if (str.trimRight) return str.trimRight();
  return str.replace(/\s*$/, '');
};

});
require.register("component-map/index.js", function(exports, require, module){

/**
 * Module dependencies.
 */

var toFunction = require('to-function');

/**
 * Map the given `arr` with callback `fn(val, i)`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @return {Array}
 * @api public
 */

module.exports = function(arr, fn){
  var ret = [];
  fn = toFunction(fn);
  for (var i = 0; i < arr.length; ++i) {
    ret.push(fn(arr[i], i));
  }
  return ret;
};
});
require.register("yields-merge/index.js", function(exports, require, module){

/**
 * merge `b`'s properties with `a`'s.
 *
 * example:
 *
 *        var user = {};
 *        merge(user, console);
 *        // > { log: fn, dir: fn ..}
 *
 * @param {Object} a
 * @param {Object} b
 * @return {Object}
 */

module.exports = function (a, b) {
  for (var k in b) a[k] = b[k];
  return a;
};

});
require.register("learnboost-jsonp/index.js", function(exports, require, module){
/**
 * Module dependencies
 */

var debug = require('debug')('jsonp');

/**
 * Module exports.
 */

module.exports = jsonp;

/**
 * Callback index.
 */

var count = 0;

/**
 * Noop function.
 */

function noop(){}

/**
 * JSONP handler
 *
 * Options:
 *  - param {String} qs parameter (`callback`)
 *  - timeout {Number} how long after a timeout error is emitted (`60000`)
 *
 * @param {String} url
 * @param {Object|Function} optional options / callback
 * @param {Function} optional callback
 */

function jsonp(url, opts, fn){
  if ('function' == typeof opts) {
    fn = opts;
    opts = {};
  }
  if (!opts) opts = {};

  var prefix = opts.prefix || '__jp';
  var param = opts.param || 'callback';
  var timeout = null != opts.timeout ? opts.timeout : 60000;
  var enc = encodeURIComponent;
  var target = document.getElementsByTagName('script')[0] || document.head;
  var script;
  var timer;

  // generate a unique id for this request
  var id = prefix + (count++);

  if (timeout) {
    timer = setTimeout(function(){
      cleanup();
      if (fn) fn(new Error('Timeout'));
    }, timeout);
  }

  function cleanup(){
    script.parentNode.removeChild(script);
    window[id] = noop;
  }

  window[id] = function(data){
    debug('jsonp got', data);
    if (timer) clearTimeout(timer);
    cleanup();
    if (fn) fn(null, data);
  };

  // add qs component
  url += (~url.indexOf('?') ? '&' : '?') + param + '=' + enc(id);
  url = url.replace('?&', '?');

  debug('jsonp req "%s"', url);

  // create script
  script = document.createElement('script');
  script.src = url;
  target.parentNode.insertBefore(script, target);
}

});
require.register("visionmedia-debug/debug.js", function(exports, require, module){

/**
 * Expose `debug()` as the module.
 */

module.exports = debug;

/**
 * Create a debugger with the given `name`.
 *
 * @param {String} name
 * @return {Type}
 * @api public
 */

function debug(name) {
  if (!debug.enabled(name)) return function(){};

  return function(fmt){
    fmt = coerce(fmt);

    var curr = new Date;
    var ms = curr - (debug[name] || curr);
    debug[name] = curr;

    fmt = name
      + ' '
      + fmt
      + ' +' + debug.humanize(ms);

    // This hackery is required for IE8
    // where `console.log` doesn't have 'apply'
    window.console
      && console.log
      && Function.prototype.apply.call(console.log, console, arguments);
  }
}

/**
 * The currently active debug mode names.
 */

debug.names = [];
debug.skips = [];

/**
 * Enables a debug mode by name. This can include modes
 * separated by a colon and wildcards.
 *
 * @param {String} name
 * @api public
 */

debug.enable = function(name) {
  try {
    localStorage.debug = name;
  } catch(e){}

  var split = (name || '').split(/[\s,]+/)
    , len = split.length;

  for (var i = 0; i < len; i++) {
    name = split[i].replace('*', '.*?');
    if (name[0] === '-') {
      debug.skips.push(new RegExp('^' + name.substr(1) + '$'));
    }
    else {
      debug.names.push(new RegExp('^' + name + '$'));
    }
  }
};

/**
 * Disable debug output.
 *
 * @api public
 */

debug.disable = function(){
  debug.enable('');
};

/**
 * Humanize the given `ms`.
 *
 * @param {Number} m
 * @return {String}
 * @api private
 */

debug.humanize = function(ms) {
  var sec = 1000
    , min = 60 * 1000
    , hour = 60 * min;

  if (ms >= hour) return (ms / hour).toFixed(1) + 'h';
  if (ms >= min) return (ms / min).toFixed(1) + 'm';
  if (ms >= sec) return (ms / sec | 0) + 's';
  return ms + 'ms';
};

/**
 * Returns true if the given mode name is enabled, false otherwise.
 *
 * @param {String} name
 * @return {Boolean}
 * @api public
 */

debug.enabled = function(name) {
  for (var i = 0, len = debug.skips.length; i < len; i++) {
    if (debug.skips[i].test(name)) {
      return false;
    }
  }
  for (var i = 0, len = debug.names.length; i < len; i++) {
    if (debug.names[i].test(name)) {
      return true;
    }
  }
  return false;
};

/**
 * Coerce `val`.
 */

function coerce(val) {
  if (val instanceof Error) return val.stack || val.message;
  return val;
}

// persist

try {
  if (window.localStorage) debug.enable(localStorage.debug);
} catch(e){}

});
require.register("johntron-asap/asap.js", function(exports, require, module){
"use strict";

// Use the fastest possible means to execute a task in a future turn
// of the event loop.

// linked list of tasks (single, with head node)
var head = {task: void 0, next: null};
var tail = head;
var flushing = false;
var requestFlush = void 0;
var hasSetImmediate = typeof setImmediate === "function";
var domain;

if (typeof global != 'undefined') {
	// Avoid shims from browserify.
	// The existence of `global` in browsers is guaranteed by browserify.
	var process = global.process;
}

// Note that some fake-Node environments,
// like the Mocha test runner, introduce a `process` global.
var isNodeJS = !!process && ({}).toString.call(process) === "[object process]";

function flush() {
    /* jshint loopfunc: true */

    while (head.next) {
        head = head.next;
        var task = head.task;
        head.task = void 0;

        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them to interrupt flushing!

                // Ensure continuation if an uncaught exception is suppressed
                // listening process.on("uncaughtException") or domain("error").
                requestFlush();

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                    throw e;
            }
        }
    }

    flushing = false;
}

if (isNodeJS) {
    // Node.js
    requestFlush = function () {
        // Ensure flushing is not bound to any domain.
        var currentDomain = process.domain;
        if (currentDomain) {
            domain = domain || (1,require)("domain");
            domain.active = process.domain = null;
        }

        // Avoid tick recursion - use setImmediate if it exists.
        if (flushing && hasSetImmediate) {
            setImmediate(flush);
        } else {
            process.nextTick(flush);
        }

        if (currentDomain) {
            domain.active = process.domain = currentDomain;
        }
    };

} else if (hasSetImmediate) {
    // In IE10, or https://github.com/NobleJS/setImmediate
    requestFlush = function () {
        setImmediate(flush);
    };

} else if (typeof MessageChannel !== "undefined") {
    // modern browsers
    // http://www.nonblocking.io/2011/06/windownexttick.html
    var channel = new MessageChannel();
    // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
    // working message ports the first time a page loads.
    channel.port1.onmessage = function () {
        requestFlush = requestPortFlush;
        channel.port1.onmessage = flush;
        flush();
    };
    var requestPortFlush = function () {
        // Opera requires us to provide a message payload, regardless of
        // whether we use it.
        channel.port2.postMessage(0);
    };
    requestFlush = function () {
        setTimeout(flush, 0);
        requestPortFlush();
    };

} else {
    // old browsers
    requestFlush = function () {
        setTimeout(flush, 0);
    };
}

function asap(task) {
    if (isNodeJS && process.domain) {
        task = process.domain.bind(task);
    }

    tail = tail.next = {task: task, next: null};

    if (!flushing) {
        requestFlush();
        flushing = true;
    }
};

module.exports = asap;

});
require.register("chrissrogers-promise/index.js", function(exports, require, module){
'use strict';

//This file contains then/promise specific extensions to the core promise API

var Promise = require('./core.js')
var asap = require('asap')

module.exports = Promise

/* Static Functions */

function ValuePromise(value) {
  this.then = function (onFulfilled) {
    if (typeof onFulfilled !== 'function') return this
    return new Promise(function (resolve, reject) {
      asap(function () {
        try {
          resolve(onFulfilled(value))
        } catch (ex) {
          reject(ex);
        }
      })
    })
  }
}
ValuePromise.prototype = Promise.prototype

var TRUE = new ValuePromise(true)
var FALSE = new ValuePromise(false)
var NULL = new ValuePromise(null)
var UNDEFINED = new ValuePromise(undefined)
var ZERO = new ValuePromise(0)
var EMPTYSTRING = new ValuePromise('')

Promise.resolve = function (value) {
  if (value instanceof Promise) return value

  if (value === null) return NULL
  if (value === undefined) return UNDEFINED
  if (value === true) return TRUE
  if (value === false) return FALSE
  if (value === 0) return ZERO
  if (value === '') return EMPTYSTRING

  if (typeof value === 'object' || typeof value === 'function') {
    try {
      var then = value.then
      if (typeof then === 'function') {
        return new Promise(then.bind(value))
      }
    } catch (ex) {
      return new Promise(function (resolve, reject) {
        reject(ex)
      })
    }
  }

  return new ValuePromise(value)
}

Promise.from = Promise.cast = function (value) {
  var err = new Error('Promise.from and Promise.cast are deprecated, use Promise.resolve instead')
  err.name = 'Warning'
  console.warn(err.stack)
  return Promise.resolve(value)
}

Promise.denodeify = function (fn, argumentCount) {
  argumentCount = argumentCount || Infinity
  return function () {
    var self = this
    var args = Array.prototype.slice.call(arguments)
    return new Promise(function (resolve, reject) {
      while (args.length && args.length > argumentCount) {
        args.pop()
      }
      args.push(function (err, res) {
        if (err) reject(err)
        else resolve(res)
      })
      fn.apply(self, args)
    })
  }
}
Promise.nodeify = function (fn) {
  return function () {
    var args = Array.prototype.slice.call(arguments)
    var callback = typeof args[args.length - 1] === 'function' ? args.pop() : null
    try {
      return fn.apply(this, arguments).nodeify(callback)
    } catch (ex) {
      if (callback === null || typeof callback == 'undefined') {
        return new Promise(function (resolve, reject) { reject(ex) })
      } else {
        asap(function () {
          callback(ex)
        })
      }
    }
  }
}

Promise.all = function () {
  var calledWithArray = arguments.length === 1 && Array.isArray(arguments[0])
  var args = Array.prototype.slice.call(calledWithArray ? arguments[0] : arguments)

  if (!calledWithArray) {
    var err = new Error('Promise.all should be called with a single array, calling it with multiple arguments is deprecated')
    err.name = 'Warning'
    console.warn(err.stack)
  }

  return new Promise(function (resolve, reject) {
    if (args.length === 0) return resolve([])
    var remaining = args.length
    function res(i, val) {
      try {
        if (val && (typeof val === 'object' || typeof val === 'function')) {
          var then = val.then
          if (typeof then === 'function') {
            then.call(val, function (val) { res(i, val) }, reject)
            return
          }
        }
        args[i] = val
        if (--remaining === 0) {
          resolve(args);
        }
      } catch (ex) {
        reject(ex)
      }
    }
    for (var i = 0; i < args.length; i++) {
      res(i, args[i])
    }
  })
}

Promise.reject = function (value) {
  return new Promise(function (resolve, reject) { 
    reject(value);
  });
}

Promise.race = function (values) {
  return new Promise(function (resolve, reject) { 
    values.forEach(function(value){
      Promise.resolve(value).then(resolve, reject);
    })
  });
}

/* Prototype Methods */

Promise.prototype.done = function (onFulfilled, onRejected) {
  var self = arguments.length ? this.then.apply(this, arguments) : this
  self.then(null, function (err) {
    asap(function () {
      throw err
    })
  })
}

Promise.prototype.nodeify = function (callback) {
  if (typeof callback != 'function') return this

  this.then(function (value) {
    asap(function () {
      callback(null, value)
    })
  }, function (err) {
    asap(function () {
      callback(err)
    })
  })
}

Promise.prototype['catch'] = function (onRejected) {
  return this.then(null, onRejected);
}

});
require.register("chrissrogers-promise/core.js", function(exports, require, module){
'use strict';

var asap = require('asap')

module.exports = Promise
function Promise(fn) {
  if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new')
  if (typeof fn !== 'function') throw new TypeError('not a function')
  var state = null
  var value = null
  var deferreds = []
  var self = this

  this.then = function(onFulfilled, onRejected) {
    return new self.constructor(function(resolve, reject) {
      handle(new Handler(onFulfilled, onRejected, resolve, reject))
    })
  }

  function handle(deferred) {
    if (state === null) {
      deferreds.push(deferred)
      return
    }
    asap(function() {
      var cb = state ? deferred.onFulfilled : deferred.onRejected
      if (cb === null) {
        (state ? deferred.resolve : deferred.reject)(value)
        return
      }
      var ret
      try {
        ret = cb(value)
      }
      catch (e) {
        deferred.reject(e)
        return
      }
      deferred.resolve(ret)
    })
  }

  function resolve(newValue) {
    try { //Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.')
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then
        if (typeof then === 'function') {
          doResolve(then.bind(newValue), resolve, reject)
          return
        }
      }
      state = true
      value = newValue
      finale()
    } catch (e) { reject(e) }
  }

  function reject(newValue) {
    state = false
    value = newValue
    finale()
  }

  function finale() {
    for (var i = 0, len = deferreds.length; i < len; i++)
      handle(deferreds[i])
    deferreds = null
  }

  doResolve(fn, resolve, reject)
}


function Handler(onFulfilled, onRejected, resolve, reject){
  this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null
  this.onRejected = typeof onRejected === 'function' ? onRejected : null
  this.resolve = resolve
  this.reject = reject
}

/**
 * Take a potentially misbehaving resolver function and make sure
 * onFulfilled and onRejected are only called once.
 *
 * Makes no guarantees about asynchrony.
 */
function doResolve(fn, onFulfilled, onRejected) {
  var done = false;
  try {
    fn(function (value) {
      if (done) return
      done = true
      onFulfilled(value)
    }, function (reason) {
      if (done) return
      done = true
      onRejected(reason)
    })
  } catch (ex) {
    if (done) return
    done = true
    onRejected(ex)
  }
}

});
require.register("kewah-mixin/index.js", function(exports, require, module){
if (typeof Object.keys === 'function') {
  module.exports = function(to, from) {
    Object.keys(from).forEach(function(property) {
      Object.defineProperty(to, property, Object.getOwnPropertyDescriptor(from, property));
    });
  };
} else {
  module.exports = function(to, from) {
    for (var property in from) {
      if (from.hasOwnProperty(property)) {
        to[property] = from[property];
      }
    }
  };
}

});
require.register("pluma-par/dist/par.js", function(exports, require, module){
/*! par 0.3.0 Original author Alan Plum <me@pluma.io>. Released into the Public Domain under the UNLICENSE. @preserve */
var slice = Array.prototype.slice;

function par(fn) {
    var args0 = slice.call(arguments, 1);
    return function() {
        var argsN = slice.call(arguments, 0),
            args = [];
        args.push.apply(args, args0);
        args.push.apply(args, argsN);
        return fn.apply(this, args);
    };
}

function rpartial(fn) {
    var argsN = slice.call(arguments, 1);
    return function() {
        var args = slice.call(arguments, 0);
        args.push.apply(args, argsN);
        return fn.apply(this, args);
    };
}

par.rpartial = rpartial;
par.lpartial = par;

module.exports = par;

});
require.register("ianstormtaylor-to-no-case/index.js", function(exports, require, module){

/**
 * Expose `toNoCase`.
 */

module.exports = toNoCase;


/**
 * Test whether a string is camel-case.
 */

var hasSpace = /\s/;
var hasCamel = /[a-z][A-Z]/;
var hasSeparator = /[\W_]/;


/**
 * Remove any starting case from a `string`, like camel or snake, but keep
 * spaces and punctuation that may be important otherwise.
 *
 * @param {String} string
 * @return {String}
 */

function toNoCase (string) {
  if (hasSpace.test(string)) return string.toLowerCase();

  if (hasSeparator.test(string)) string = unseparate(string);
  if (hasCamel.test(string)) string = uncamelize(string);
  return string.toLowerCase();
}


/**
 * Separator splitter.
 */

var separatorSplitter = /[\W_]+(.|$)/g;


/**
 * Un-separate a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function unseparate (string) {
  return string.replace(separatorSplitter, function (m, next) {
    return next ? ' ' + next : '';
  });
}


/**
 * Camelcase splitter.
 */

var camelSplitter = /(.)([A-Z]+)/g;


/**
 * Un-camelcase a `string`.
 *
 * @param {String} string
 * @return {String}
 */

function uncamelize (string) {
  return string.replace(camelSplitter, function (m, previous, uppers) {
    return previous + ' ' + uppers.toLowerCase().split('').join(' ');
  });
}
});
require.register("ianstormtaylor-to-space-case/index.js", function(exports, require, module){

var clean = require('to-no-case');


/**
 * Expose `toSpaceCase`.
 */

module.exports = toSpaceCase;


/**
 * Convert a `string` to space case.
 *
 * @param {String} string
 * @return {String}
 */


function toSpaceCase (string) {
  return clean(string).replace(/[\W_]+(.|$)/g, function (matches, match) {
    return match ? ' ' + match : '';
  });
}
});
require.register("ianstormtaylor-to-slug-case/index.js", function(exports, require, module){

var toSpace = require('to-space-case');


/**
 * Expose `toSlugCase`.
 */

module.exports = toSlugCase;


/**
 * Convert a `string` to slug case.
 *
 * @param {String} string
 * @return {String}
 */


function toSlugCase (string) {
  return toSpace(string).replace(/\s/g, '-');
}
});
require.register("recurly/lib/index.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var Recurly = require('./recurly');

/**
 * Export a single instance.
 */

module.exports = exports = new Recurly();

/**
 * Hack for testing.
 */

exports.Recurly = Recurly;

});
require.register("recurly/lib/recurly.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var bind = require('bind');
var json = require('json');
var each = require('each');
var type = require('type');
var merge = require('merge');
var mixin = require('mixin');
var jsonp = require('jsonp');
var qs = require('querystring');
var Emitter = require('emitter');
var errors = require('./errors');
var version = require('./version');
var debug = require('debug')('recurly');

/**
 * Default configuration values.
 *
 * @private
 * @type {Object}
 */

var defaults = {
    currency: 'USD'
  , timeout: 60000
  , publicKey: ''
  , api: 'https://api.recurly.com/js/v1'
};

/**
 * API mixins.
 *
 * @type {Array}
 * @private
 */

var mixins = [
    'open'
  , 'coupon'
  , 'paypal'
  , 'plan'
  , 'tax'
  , 'token'
  , 'pricing'
  , 'validate'
];

/**
 * Export `Recurly`.
 */

module.exports = Recurly;

/**
 * Initialize defaults.
 *
 * @param {Object} options
 * @constructor
 * @public
 */

function Recurly (options) {
  this.id = 0;
  this.version = version;
  this.configured = false;
  this.config = merge({}, defaults);
  if (options) this.configure(options);
}

/**
 * Inherits `Emitter`.
 */

Emitter(Recurly.prototype);

/**
 * Configure settings.
 *
 * @param {String|Object} options Either publicKey or object containing
 *                                publicKey and other optional members
 * @param {String} options.publicKey
 * @param {String} [options.currency]
 * @param {String} [options.api]
 * @public
 */

Recurly.prototype.configure = function configure (options) {
  if (this.configured) throw errors('already-configured');

  debug('configure');

  if (type(options) === 'string') options = { publicKey: options };

  if ('publicKey' in options) {
    this.config.publicKey = options.publicKey;
  } else {
    throw errors('missing-public-key');
  }

  if ('api' in options) {
    this.config.api = options.api;
  }

  if ('currency' in options) {
    this.config.currency = options.currency;
  }

  this.configured = true;
};

/**
 * Assembles the API endpoint.
 *
 * @return {String} route
 * @private
 */

Recurly.prototype.url = function url (route) {
  return this.config.api + route;
};

/**
 * Issues an API request.
 *
 * @param {String} route
 * @param {Object} [data]
 * @param {Function} done
 * @throws {Error} If `configure` has not been called.
 * @private
 */

Recurly.prototype.request = function request (route, data, done) {
  debug('request');

  if (false === this.configured) {
    throw errors('not-configured');
  }

  if ('function' == type(data)) {
    done = data;
    data = {};
  }

  var url = this.url(route);
  var timeout = this.config.timeout;

  data.version = this.version;
  data.key = this.config.publicKey;

  url += '?' + qs.stringify(data);

  this.cache(url, function (res, set) {
    if (res) return done(null, res);
    jsonp(url, { timeout: timeout }, function (err, res) {
      if (err) return done(err);
      if (res.error) {
        done(errors('api-error', res.error));
      } else {
        done(null, set(res));
      }
    });
  });
};

/**
 * Caches an object
 *
 * TODO: figure out invalidation & expiry
 *
 * @param {String} url
 * @param {Function} done
 * @private
 */
 
Recurly.prototype.cache = function cache (url, done) {
  debug('cache');
  var stored = localStorage.getItem(url);
  if (stored) {
    debug('cache found ' + url);
    return done(json.parse(stored));
  } else {
    debug('cache set ' + url);
    return done(null, set);
  }
  function set (obj) {
    // disabled for now
    // localStorage.setItem(url, json.stringify(obj));
    return obj;
  }
};

/**
 * Load the `mixins` onto Recurly.prototype.
 */

each(mixins, function (name) {
  mixin(Recurly.prototype, require('./recurly/' + name));
});

});
require.register("recurly/lib/version.js", function(exports, require, module){

/**
 * Current package/component version.
 */

module.exports = '3.0.5';

});
require.register("recurly/lib/errors.js", function(exports, require, module){
/**
 * dependencies
 */

var mixin = require('mixin');

/**
 * Export `errors`.
 */

module.exports = exports = errors;

/**
 * Error accessor.
 *
 * @param {String} name
 * @param {Object} options
 * @return {Error}
 */

function errors (name, options) {
  return errors.get(name, options);
}

/**
 * Defined errors.
 *
 * @type {Object}
 * @private
 */

errors.map = {};

/**
 * Base url for documention.
 *
 * @type {String}
 * @private
 */

errors.baseURL = '';

/**
 * Sets the `baseURL` for docs.
 *
 * @param {String} url
 * @public
 */

errors.doc = function (baseURL) {
  errors.baseURL = baseURL;
};

/**
 * Gets errors defined by `name`.
 *
 * @param {String} name
 * @param {Object} context
 * @return {Error}
 * @public
 */

errors.get = function (name, context) {
  if (!(name in errors.map)) {
    throw new Error('invalid error');
  } else {
    return new errors.map[name](context);
  }
};

/**
 * Registers an error defined by `name` with `config`.
 *
 * @param {String} name
 * @param {Object} config
 * @return {Error}
 * @public
 */

errors.add = function (name, config) {
  config = config || {};

  function RecurlyError (context) {
    Error.call(this);

    this.name = this.code = name;
    this.message = config.message;
    mixin(this, context || {});

    if (config.help) {
      this.help = errors.baseURL + config.help;
      this.message += ' (need help? ' + this.help + ')';
    }
  };

  RecurlyError.prototype = new Error();
  return errors.map[name] = RecurlyError;
};

/**
 * Internal definations.
 *
 * TODO(gjohnson): open source this as a component
 * and move these out.
 */

errors.doc('https://docs.recurly.com/js');

errors.add('already-configured', {
  message: 'Configuration may only be set once.',
  help: '#identify-your-site'
});

errors.add('not-configured', {
  message: 'Not configured. You must first call recurly.configure().',
  help: '#identify-your-site'
});

errors.add('missing-public-key', {
  message: 'The publicKey setting is required.',
  help: '#identify-your-site'
});

errors.add('api-error', {
  message: 'There was an error with your request.'
});

errors.add('validation', {
  message: 'There was an error validating your request.'
});

errors.add('missing-callback', {
  message: 'Missing callback'
});

errors.add('invalid-options', {
  message: 'Options must be an object'
});

errors.add('missing-plan', {
  message: 'A plan must be specified.'
});

errors.add('missing-coupon', {
  message: 'A coupon must be specified.'
});

errors.add('invalid-item', {
  message: 'The given item does not appear to be a valid recurly plan, coupon, addon, or taxable address.'
});

errors.add('invalid-addon', {
  message: 'The given addon_code is not among the valid addons for the specified plan.'
});

errors.add('invalid-currency', {
  message: 'The given currency is not among the valid codes for the specified plan.'
});

errors.add('unremovable-item', {
  message: 'The given item cannot be removed.'
});

});
require.register("recurly/lib/util/dom.js", function(exports, require, module){
/**
 * dependencies
 */

var slug = require('to-slug-case');
var type = require('type');
var each = require('each');
var map = require('map');

/**
 * expose
 */

module.exports = {
  element: element,
  value: value,
  data: data
};

/**
 * Detects whether an object is an html element.
 *
 * @param {Mixed} node
 * @return {HTMLElement|Boolean} node
 */

function element (node) {
  var isJQuery = window.jQuery && node instanceof jQuery;
  var isArray = type(node) === 'array';
  if (isJQuery || isArray) node = node[0];

  var isElem = typeof HTMLElement !== 'undefined'
    ? node instanceof HTMLElement
    : node && node.nodeType === 1;

  return isElem && node;
};

/**
 * Gets or sets the value of a given HTML form element
 *
 * supports text inputs, radio inputs, and selects
 *
 * @param {HTMLElement} node
 * @return {String} value of the element
 */

function value (node, value) {
  if (!element(node)) return null;
  return typeof value !== 'undefined'
    ? valueSet(node, value)
    : valueGet(node);
}

/**
 * Gets an HTMLElement's value property in the context of a form
 *
 * @param {HTMLElement} node
 * @return {String} node's value
 */

function valueGet (node) {
  node = element(node);

  var nodeType = node && node.type && node.type.toLowerCase();
  var value;

  if (!nodeType) {
    value = '';
  } else if ('options' in node) {
    value = node.options[node.selectedIndex].value;
  } else if (nodeType === 'checkbox') {
    if (node.checked) value = node.value;
  } else if (nodeType === 'radio') {
    var radios = document.querySelectorAll('input[data-recurly="' + data(node, 'recurly') + '"]');
    each(radios, function (radio) {
      if (radio.checked) value = radio.value;
    });
  } else if ('value' in node) {
    value = node.value;
  }

  return value;
}

/**
 * Updates an element's value property if
 * one exists; else innerText if it exists
 *
 * @param {Array[HTMLElement]} nodes
 * @param {Mixed} value
 */

function valueSet (nodes, value) {
  if (type(nodes) !== 'array') nodes = [nodes];
  each(nodes, function (node) {
    if (!node) return;
    else if ('value' in node)
      node.value = value;
    else if ('textContent' in node)
      node.textContent = value;
    else if ('innerText' in node)
      node.innerText = value;
  });
}

/**
 * Gets or sets a node's data attribute
 *
 * @param {HTMLElement} node
 * @param {String} key
 * @param {Mixed} [value]
 */

function data (node, key, value) {
  node = element(node);
  if (!node) return;
  return typeof value !== 'undefined'
    ? dataSet(node, key, value)
    : dataGet(node, key);
}

/**
 * Gets a node's data attribute
 *
 * @param {HTMLElement} node
 * @param {String} key
 */

function dataGet (node, key) {
  return node.dataset
    ? node.dataset[key]
    : node.getAttribute('data-' + slug(key));
}

/**
 * sets a node's data attribute
 *
 * @param {HTMLElement} node
 * @param {String} key
 * @param {Mixed} value
 */

function dataSet (node, key, value) {
  if (node.dataset) node.dataset[key] = value;
  else node.setAttribute('data-' + slug(key), value);
}

});
require.register("recurly/lib/util/parse-card.js", function(exports, require, module){

/**
 * Removes dashes and spaces from a card number.
 *
 * @param {Number|String} number
 * @return {String} parsed card number
 */

module.exports = function parseCard (number) {
  return number && number.toString().replace(/[-\s]/g, '');
};

});
require.register("recurly/lib/recurly/open.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var bind = require('bind');
var type = require('type');
var json = require('json');
var events = require('event');
var qs = require('querystring');
var errors = require('../errors');
var debug = require('debug')('recurly:open');

/**
 * Issues an API request to a popup window.
 *
 * TODO(*): configurable window name?
 * TODO(*): configurable window properties?
 *
 * @param {String} url
 * @param {Object} [data]
 * @param {Function} [done]
 * @throws {Error} If `configure` has not been called.
 * @return {Window}
 * @private
 */

exports.open = function (url, data, done) {
  debug('open');
  
  if (false === this.configured) {
    throw errors('not-configured');
  }

  if ('function' == type(data)) {
    done = data;
    data = {};
  }

  data = data || {};
  data.version = this.version;
  data.event = 'recurly-open-' + this.id++;
  data.key = this.config.publicKey;
  this.once(data.event, done);

  if (!/^https?:\/\//.test(url)) url = this.url(url);
  url += (~url.indexOf('?') ? '&' : '?') + qs.stringify(data);

  this.relay(function () {
    window.open(url);
  });
};

/**
 * Relay mixin.
 *
 * Inspects the window for intent to relay a message,
 * then attempts to send it off. closes the window once
 * dispatched.
 *
 * @param {Function} done
 * @private
 */

exports.relay = function (done) {
  var self = this;

  if (false === this.configured) {
    throw errors('not-configured');
  }

  events.bind(window, 'message', function listener (event) {
    var data = json.parse(event.data);
    var name = data.recurly_event;
    var body = data.recurly_message;
    var err = body.error ? errors('api-error', body.error) : null;
    events.unbind(window, 'message', listener);
    if (name) self.emit(name, err, body);
    if (frame) document.body.removeChild(frame);
  });

  if ('documentMode' in document) {
    var frame = document.createElement('iframe');
    frame.width = frame.height = 0;
    frame.src = this.url('/relay');
    frame.name = 'recurly-relay';
    frame.style.display = 'none';
    frame.onload = bind(this, done);
    document.body.appendChild(frame);
  } else {
    done();
  }
};

});
require.register("recurly/lib/recurly/coupon.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var type = require('type');
var debug = require('debug')('recurly:coupon');
var errors = require('../errors');

/**
 * Coupon mixin.
 *
 * Retrieves coupon information for the `plan`. The `callback` signature
 * is `err, plan` where `err` may be a request or server error, and `plan`
 * is a representation of the requested plan.
 *
 * @param {Object} options
 * @param {Function} callback
 */

exports.coupon = function (options, callback) {
  debug('%j', options);

  if ('function' !== type(callback)) {
    throw errors('missing-callback');
  }

  if ('object' !== type(options)) {
    throw errors('invalid-options');
  }

  if (!('plan' in options)) {
    throw errors('missing-plan');
  }

  if (!('coupon' in options)) {
    throw errors('missing-coupon');
  }

  this.request('/plans/' + options.plan + '/coupons/' + options.coupon, options, callback);
};

});
require.register("recurly/lib/recurly/paypal.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var debug = require('debug')('recurly:paypal');

/**
 * Paypal mixin.
 *
 * @param {Object} data
 * @param {Function} done callback
 */

exports.paypal = function (data, done) {
  debug('start');
  this.open('/paypal/start', data, done);
};

});
require.register("recurly/lib/recurly/plan.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var type = require('type');
var debug = require('debug')('recurly:plan');

/**
 * Plan mixin.
 *
 * Retrieves information for the `plan`. The `callback` signature
 * is `err, plan` where `err` may be a request or server error, and `plan`
 * is a representation of the requested plan.
 *
 * @param {String} code
 * @param {Function} callback
 */

exports.plan = function (code, callback) {
  debug('%s', code);

  if ('function' != type(callback)) {
    throw new Error('Missing callback');
  }

  if ('undefined' == type(code)) {
    return callback(new Error('Missing plan code'));
  }

  this.request('/plans/' + code, callback);
};

});
require.register("recurly/lib/recurly/tax.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var type = require('type');
var clone = require('clone');
var debug = require('debug')('recurly:tax');

/**
 * Tax mixin.
 *
 * Provides a tax estiamte for the given address.
 *
 * @param {Object} options
 * @param {Object} options.postal_code
 * @param {Object} options.country
 * @param {Object} [options.vat_number] Used for VAT exemptions
 * @param {Function} callback
 */

exports.tax = function (options, callback) {
  var request = clone(options);

  if ('function' != type(callback)) {
    throw new Error('Missing callback');
  }

  if (!('currency' in request)) {
    request.currency = this.config.currency;
  }

  this.request('/tax', request, callback);
};

});
require.register("recurly/lib/recurly/token.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var bind = require('bind');
var each = require('each');
var type = require('type');
var index = require('indexof');
var debug = require('debug')('recurly:token');
var dom = require('../util/dom');
var parseCard = require('../util/parse-card');
var errors = require('../errors');

/**
 * Fields that are sent to API.
 *
 * @type {Array}
 * @private
 */

var fields = [
    'first_name'
  , 'last_name'
  , 'number'
  , 'month'
  , 'year'
  , 'cvv'
  , 'address1'
  , 'address2'
  , 'country'
  , 'city'
  , 'state'
  , 'postal_code'
  , 'phone'
  , 'vat_number'
  , 'token'
];

/**
 * Generates a token from customer data.
 *
 * The callback signature: `err, response` where `err` is a
 * connection, request, or server error, and `response` is the
 * recurly service response. The generated token is accessed
 * at `response.token`.
 *
 * @param {Object|HTMLFormElement} options Billing properties or an HTMLFormElement
 * with children corresponding to billing properties via 'data-reurly' attributes.
 * @param {String} options.first_name customer first name
 * @param {String} options.last_name customer last name
 * @param {String|Number} options.number card number
 * @param {String|Number} options.month card expiration month
 * @param {String|Number} options.year card expiration year
 * @param {String|Number} options.cvv card verification value
 * @param {String} [options.address1]
 * @param {String} [options.address2]
 * @param {String} [options.country]
 * @param {String} [options.city]
 * @param {String} [options.state]
 * @param {String|Number} [options.postal_code]
 * @param {Function} done callback
 */

exports.token = function (options, done) {
  var open = bind(this, this.open);
  var data = normalize(options);
  var input = data.values;
  var userErrors = validate.call(this, input);

  if ('function' !== type(done)) {
    throw errors('missing-callback');
  }

  if (userErrors.length) {
    return done(errors('validation', { fields: userErrors }));
  }

  this.request('/token', input, function (err, res) {
    if (err) return done(err);
    if (data.fields.token && res.id) {
      data.fields.token.value = res.id;
    }
    done(null, res);
  });
};

/**
 * Parses options out of a form element and normalizes according to rules.
 *
 * @param {Object|HTMLFormElement} options
 * @return {Object}
 */

function normalize (options) {
  var el = dom.element(options);
  var data = { fields: {}, values: {} };

  if (el && 'form' === el.nodeName.toLowerCase()) {
    each(el.querySelectorAll('[data-recurly]'), function (field) {
      var name = dom.data(field, 'recurly');
      if (~index(fields, name)) {
        data.fields[name] = field;
        data.values[name] = dom.value(field);
      }
    });
  } else {
    data.values = options;
  }

  data.values.number = parseCard(data.values.number);

  return data;
}

/**
 * Checks user input on a token call
 *
 * @param {Object} input
 * @return {Array} indicates which fields are not valid
 */

function validate (input) {
  var errors = [];

  if (!this.validate.cardNumber(input.number)) {
    errors.push('number');
  }

  if (!this.validate.expiry(input.month, input.year)) {
    errors.push('month', 'year');
  }

  if (!input.first_name) {
    errors.push('first_name');
  }

  if (!input.last_name) {
    errors.push('last_name');
  }

  return errors;
}

});
require.register("recurly/lib/recurly/validate.js", function(exports, require, module){

/*!
 * Module dependencies.
 */

var find = require('find');
var trim = require('trim');
var index = require('indexof');
var parseCard = require('../util/parse-card');

/**
 * Card patterns.
 *
 * @private
 */

var types = [
  {
    type: 'discover',
    pattern: /^(6011|622|64[4-9]|65)/,
    lengths: [16]
  }
  , {
    type: 'master',
    pattern: /^5[0-5]/,
    lengths: [16]
  }
  , {
    type: 'american_express',
    pattern: /^3[47]/,
    lengths: [15]
  }
  , {
    type: 'visa',
    pattern: /^4/,
    lengths: [13, 16]
  }
  , {
    type: 'jcb',
    pattern: /^35[2-8]\d/,
    lengths: [16]
  }
  , {
    type: 'diners_club',
    pattern: /^(30[0-5]|309|36|3[89]|54|55|2014|2149)/,
    lengths: [14]
  }
];

/**
 * Validate mixin.
 *
 * @public
 */

exports.validate = {

  /**
   * Validates a credit card number via luhn algorithm.
   *
   * @param {Number|String} number The card number.
   * @return {Boolean}
   * @see https://sites.google.com/site/abapexamples/javascript/luhn-validation
   */

  cardNumber: function (number) {
    var str = parseCard(number);
    var ca, sum = 0, mul = 1;
    var i = str.length;

    while (i--) {
      ca = parseInt(str.charAt(i), 10) * mul;
      sum += ca - (ca > 9) * 9;
      mul ^= 3;
    }

    return sum % 10 === 0 && sum > 0;
  },

  /**
   * Returns the type of the card number as a string.
   *
   * TODO(chrissrogers): Maybe undefined instread of "unknown"?
   *
   * @param {Number|String} number The card number
   * @return {String} card type
   */

  cardType: function (number) {
    var str = parseCard(number);
    var card = find(types, function (card) {
      return card.pattern.test(str) && ~index(card.lengths, str.length);
    });
    return card && card.type || 'unknown';
  },

  /**
   * Validates whether an expiry month is present or future.
   *
   * @param {Numer|String} month The 2 digit month
   * @param {Numer|String} year The 2 or 4 digit year
   * @return {Boolean}
   */

  expiry: function (month, year) {
    month = parseInt(month, 10) - 1;
    if (month < 0 || month > 11) return false;
    year = parseInt(year, 10);
    year += year < 100 ? 2000 : 0;

    var expiry = new Date;
    expiry.setYear(year);
    expiry.setDate(1);
    expiry.setHours(0);
    expiry.setMinutes(0);
    expiry.setSeconds(0);
    expiry.setMonth(month + 1);
    return new Date < expiry;
  },

  /**
   * Validates whether a number looks like a cvv.
   *
   * e.g.: '123', '0321'
   *
   * @param {Number|String} number The card verification value
   * @return {Boolean}
   */

  cvv: function (number) {
    number = trim(number + '');
    return /^\d+$/.test(number) && (number.length === 3 || number.length === 4);
  }

};

});
require.register("recurly/lib/recurly/pricing/index.js", function(exports, require, module){
/**
 * dependencies
 */

var Emitter = require('emitter');
var index = require('indexof');
var each = require('each');
var type = require('type');
var bind = require('bind');
var find = require('find');
var mixin = require('mixin');
var keys = require('object').keys;
var json = require('json');
var debug = require('debug')('recurly:pricing');
var PricingPromise = require('./promise');
var Calculations = require('./calculations');
var errors = require('../../errors');

/**
 * expose
 */

exports.Pricing = Pricing;

/**
 * Pricing
 *
 * @constructor
 * @param {Recurly} recurly
 * @public
 */

function Pricing (recurly) {
  if (this instanceof require('../../recurly')) return new Pricing(this);
  this.recurly = recurly;
  this.reset();
}

Emitter(Pricing.prototype);

/**
 * Subscription properties
 */

Pricing.properties = [
    'plan'
  , 'addon'
  , 'coupon'
  , 'address'
  , 'currency'
];

/**
 * Resets the pricing calculator
 *
 * @public
 */

Pricing.prototype.reset = function () {
  this.items = {};
  this.items.addons = [];
  this.currency(this.recurly.config.currency);
};

/**
 * Removes an object from the pricing model
 *
 * example
 *
 *   .remove({ plan: 'plan_code' });
 *   .remove({ addon: 'addon_code' });
 *   .remove({ coupon: 'coupon_code' });
 *   .remove({ address: true }); // to remove without specifying a code
 *
 * @param {Object} opts
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.remove = function (opts, done) {
  var self = this;
  var item;
  debug('remove');

  return new PricingPromise(function (resolve, reject) {
    var prop = keys(opts)[0];
    var id = opts[prop];
    if (!~index(Pricing.properties, prop)) return reject(errors('invalid-item'));
    if (prop === 'addon') {
      var pos = index(self.items.addons, findAddon(self.items.addons, { code: id }));
      if (~pos) {
        item = self.items.addons.splice(pos);
      }
    } else if (self.items[prop] && (id === self.items[prop].code || id === true)) {
      item = self.items[prop]
      delete self.items[prop];
    } else {
      return reject(errors('unremovable-item', {
          type: prop
        , id: id
        , reason: 'does not exist on this pricing instance.'
      }));
    }
  }, this).nodeify(done);
};

/**
 * Provides a subscription price estimate using current state
 *
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.reprice = function (done) {
  var self = this;
  debug('reprice');

  return new PricingPromise(function (resolve, reject) {
    if (!self.items.plan) return reject(errors('missing-plan'));

    Calculations(self, function (price) {
      if (json.stringify(price) === json.stringify(self.price)) return resolve(price);
      self.price = price;
      self.emit('change', price);
      resolve(price);
    });
  }, this).nodeify(done);
};

/**
 * Updates plan
 *
 * @param {String} planCode
 * @param {Object} [meta]
 * @param {Number} [meta.quantity]
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.plan = function (planCode, meta, done) {
  var self = this;
  var plan = this.items.plan;
  var quantity;

  if (type(meta) === 'function') {
    done = meta;
    meta = undefined;
  }

  meta = meta || {};

  // meta.quantity, plan.quantity, 1
  if (plan && plan.quantity) quantity = plan.quantity;
  if (meta.quantity) quantity = parseInt(meta.quantity, 10);
  if (!quantity || quantity < 1) quantity = 1;

  return new PricingPromise(function (resolve, reject) {
    if (plan && plan.code === planCode) {
      plan.quantity = quantity;
      return resolve(plan);
    }

    self.recurly.plan(planCode, function (err, plan) {
      if (err) return reject(err);

      plan.quantity = quantity;
      self.items.plan = plan;

      if (!(self.items.currency in plan.price)) {
        self.currency(keys(plan.price)[0]);
      }

      debug('set.plan');
      self.emit('set.plan', plan);
      resolve(plan);
    });
  }, this).nodeify(done);
};

/**
 * Updates addon
 *
 * @param {String} addonCode
 * @param {Object} [meta]
 * @param {Number} [meta.quantity]
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.addon = function (addonCode, meta, done) {
  var self = this;

  if (type(meta) === 'function') {
    done = meta;
    meta = undefined;
  }

  meta = meta || {};

  return new PricingPromise(function (resolve, reject) {
    if (!self.items.plan) return reject(errors('missing-plan'));

    var planAddon = findAddon(self.items.plan.addons, addonCode);
    if (!planAddon) {
      return reject(errors('invalid-addon', {
          planCode: self.items.plan.code
        , addonCode: addonCode
      }));
    }

    var quantity = addonQuantity(meta, planAddon);
    var addon = findAddon(self.items.addons, addonCode);

    if (quantity === 0) {
      self.remove({ addon: addonCode });
    }

    if (addon) {
      addon.quantity = quantity;
    } else {
      addon = json.parse(json.stringify(planAddon));
      addon.quantity = quantity;
      self.items.addons.push(addon);
    }

    debug('set.addon');
    self.emit('set.addon', addon);
    resolve(addon);
  }, this).nodeify(done);
};

/**
 * Updates coupon
 *
 * @param {String} couponCode
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.coupon = function (couponCode, done) {
  var self = this;
  var coupon = this.items.coupon;

  return new PricingPromise(function (resolve, reject) {
    if (!self.items.plan) return reject(errors('missing-plan'));
    if (coupon) {
      if (coupon.code === couponCode) return resolve(coupon);
      else self.remove({ coupon: coupon.code });
    }
    if (!couponCode) return resolve();

    self.recurly.coupon({ plan: self.items.plan.code, coupon: couponCode }, function (err, coupon) {
      if (err && err.code !== 'not_found') return reject(err);

      self.items.coupon = coupon;

      debug('set.coupon');
      self.emit('set.coupon', coupon);
      resolve(coupon);
    });
  }, this).nodeify(done);
};

/**
 * Updates address
 *
 * @param {Object} address
 * @param {String} address.country
 * @param {String|Number} address.postal_code
 * @param {String} address.vat_number
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.address = function (address, done) {
  var self = this;

  return new PricingPromise(function (resolve, reject) {
    if (json.stringify(address) === json.stringify(self.items.address)) {
      return resolve(self.items.address);
    }

    self.items.address = address;

    debug('set.address');
    self.emit('set.address', address);
    resolve(address);
  }, this).nodeify(done);
};

/**
 * Updates or retrieves currency code
 *
 * @param {String} code
 * @param {Function} [done] callback
 * @public
 */

Pricing.prototype.currency = function (code, done) {
  var self = this;
  var plan = this.items.plan
  var currency = this.items.currency;

  return new PricingPromise(function (resolve, reject) {
    if (currency === code) return resolve(currency);
    if (plan && !(code in plan.price)) {
      return reject(errors('invalid-currency', {
          currencyCode: code
        , planCurrencies: keys(plan.price)
      }));
    }

    self.items.currency = code;

    debug('set.currency');
    self.emit('set.currency', code);
    resolve(code);
  }, this).nodeify(done);
};

/**
 * DOM attachment mixin
 */

mixin(Pricing.prototype, require('./attach'));

/**
 * Utility functions
 */

function addonQuantity (meta, planAddon) {
  var qty = 1;
  if ('quantity' in planAddon) qty = planAddon.quantity;
  if ('quantity' in meta) qty = meta.quantity;
  return parseInt(qty, 10) || 0;
}

function findAddon (addons, code) {
  return addons && find(addons, { code: code });
}

});
require.register("recurly/lib/recurly/pricing/promise.js", function(exports, require, module){
/**
 * Dependencies
 */

var Promise = require('promise');
var mixin = require('mixin');
var bind = require('bind');
var each = require('each');
var type = require('type');
var par = require('par');
var debug = require('debug')('recurly:pricing:promise');

/**
 * Expose
 */

module.exports = PricingPromise;

/**
 * PricingPromise
 *
 * issues repricing when .done
 *
 * contains .then wrappers for Pricing property methods
 *
 * Usage
 *
 *   var pricing = recurly.Pricing();
 *   
 *   pricing
 *     .plan('basic')
 *     .addon('addon1')
 *     .then(process)
 *     .catch(errors)
 *     .done();
 *
 * @param {Function} resolver
 * @param {Pricing} pricing bound instance
 * @constructor
 * @public
 */

function PricingPromise (resolver, pricing) {
  if (!(this instanceof PricingPromise)) return new PricingPromise(resolver, pricing);

  var self = this;
  this.pricing = pricing;
  this.constructor = par.rpartial(this.constructor, pricing);

  Promise.call(this, resolver);

  // for each pricing method, create a promise wrapper method
  each(require('./').Pricing.prototype, function (method) {
    self[method] = function () {
      var args = arguments;
      return self.then(function () {
        return self.pricing[method].apply(self.pricing, args);
      });
    };
  });
}

mixin(PricingPromise.prototype, Promise.prototype);
PricingPromise.prototype.constructor = PricingPromise;

/**
 * Adds a reprice and completes the control flow
 *
 * @param {Function} onFulfilled
 * @param {Function} onRejected
 * @return {Pricing} bound pricing instance
 * @public
 */

PricingPromise.prototype.done = function () {
  Promise.prototype.done.apply(this.then(this.reprice), arguments);
  return this.pricing;
};

/**
 * Adds a reprice if a callback is passed
 *
 * @param {Function} [done] callback
 * @public
 */

PricingPromise.prototype.nodeify = function (done) {
  if (type(done) === 'function') this.reprice();
  return Promise.prototype.nodeify.apply(this, arguments);
};

});
require.register("recurly/lib/recurly/pricing/calculations.js", function(exports, require, module){
/**
 * dependencies
 */

var each = require('each');
var bind = require('bind');
var find = require('find');

/**
 * expose
 */

module.exports = Calculations;

/**
 * Subscription calculation calculation
 *
 * @param {Pricing} pricing
 * @constructor
 * @public
 */

function Calculations (pricing, done) {
  if (!(this instanceof Calculations)) {
    return new Calculations(pricing, done);
  }

  this.pricing = pricing;
  this.items = pricing.items;

  this.price = {
    now: {},
    next: {},
    addons: {},
    currency: {
      code: this.items.currency,
      symbol: this.planPrice().symbol
    }
  };

  this.subtotal();

  this.tax(function () {
    this.total();
    each(this.price.now, decimal, this.price.now);
    each(this.price.next, decimal, this.price.next);
    each(this.price.addons, decimal, this.price.addons);
    done(this.price);
  });
}

/**
 * Calculates subtotal
 *
 * @private
 */

Calculations.prototype.subtotal = function () {
  var subtotal = this.planPrice().amount;

  this.price.now.subtotal = subtotal;
  this.price.next.subtotal = subtotal;

  if (this.items.plan.trial) this.price.now.subtotal = 0;

  this.addons();
  this.price.now.subtotal += this.price.now.addons;
  this.price.next.subtotal += this.price.next.addons;

  this.discount();
  this.price.now.subtotal -= this.price.now.discount;
  this.price.next.subtotal -= this.price.next.discount;

  this.setupFee();
  this.price.now.subtotal += this.price.now.setup_fee;
};

/**
 * Calculates tax
 * 
 * @param {Function} done
 * @private
 */

Calculations.prototype.tax = function (done) {
  this.price.now.tax = 0;
  this.price.next.tax = 0;

  if (this.items.address) {
    var self = this;
    this.pricing.recurly.tax(this.items.address, function applyTax (err, taxes) {
      if (err) {
        self.pricing.emit('error', err);
      } else {
        each(taxes, function (tax) {
          if (tax.type === 'usst' && self.items.plan.tax_exempt) return;
          self.price.now.tax += self.price.now.subtotal * tax.rate;
          self.price.next.tax += self.price.next.subtotal * tax.rate;
        });

        // tax estimation prefers partial cents to always round up
        self.price.now.tax = Math.ceil(self.price.now.tax * 100) / 100;
        self.price.next.tax = Math.ceil(self.price.next.tax * 100) / 100;
      }
      done.call(self);
    });
  } else done.call(this);
};

/**
 * Calculates total
 *
 * @private
 */

Calculations.prototype.total = function () {
  this.price.now.total = this.price.now.subtotal + this.price.now.tax;
  this.price.next.total = this.price.next.subtotal + this.price.next.tax;
};

/**
 * Computes addon prices and applies addons to the subtotal
 *
 * @private
 */

Calculations.prototype.addons = function () {
  this.price.now.addons = 0;
  this.price.next.addons = 0;

  each(this.items.plan.addons, function (addon) {
    var price = addon.price[this.items.currency].unit_amount;

    this.price.addons[addon.code] = price;

    var selected = find(this.items.addons, { code: addon.code });
    if (selected) {
      price = price * selected.quantity;
      if (!this.items.plan.trial) this.price.now.addons += price;
      this.price.next.addons += price;
    }
  }, this);
};

/**
 * Applies coupon discount to the subtotal
 *
 * @private
 */

Calculations.prototype.discount = function () {
  var coupon = this.items.coupon;

  this.price.now.discount = 0;
  this.price.next.discount = 0;

  if (coupon) {
    if (coupon.discount.rate) {
      this.price.now.discount = Math.round(this.price.now.subtotal * coupon.discount.rate * 100) / 100;
      this.price.next.discount = Math.round(this.price.next.subtotal * coupon.discount.rate * 100) / 100;
    } else {
      this.price.now.discount = coupon.discount.amount[this.items.currency];
      this.price.next.discount = coupon.discount.amount[this.items.currency];
    }
  }
};

/**
 * Applies plan setup fee to the subtotal
 *
 * @private
 */

Calculations.prototype.setupFee = function () {
  this.price.now.setup_fee = this.planPrice().setup_fee;
  this.price.next.setup_fee = 0;
};

/**
 * Get the price structure of a plan based on currency
 *
 * @return {Object}
 * @private
 */

Calculations.prototype.planPrice = function () {
  var plan = this.items.plan;
  var price = plan.price[this.items.currency];
  price.amount = price.unit_amount * (plan.quantity || 1);
  return price;
};

/**
 * Applies a decimal transform on an object's member
 *
 * @param {String} prop Property on {this} to transform
 * @this {Object} on which to apply decimal transformation
 * @private
 */

function decimal (prop) {
  this[prop] = (Math.round(Math.max(this[prop], 0) * 100) / 100).toFixed(2);
}

});
require.register("recurly/lib/recurly/pricing/attach.js", function(exports, require, module){
/**
 * dependencies
 */

var each = require('each');
var events = require('event');
var find = require('find');
var type = require('type');
var dom = require('../../util/dom');
var debug = require('debug')('recurly:pricing:attach');

/**
 * bind a dom element to pricing values
 *
 * @param {HTMLElement} el
 */

exports.attach = function (el) {
  var self = this;
  var elems = {};
  var el = dom.element(el);

  if (!el) throw new Error('invalid dom element');

  if (this.attach.detatch) this.attach.detatch();

  self.on('change', update);

  each(el.querySelectorAll('[data-recurly]'), function (elem) {
    // 'zip' -> 'postal_code'
    if (dom.data(elem, 'recurly') === 'zip') dom.data(elem, 'recurly', 'postal_code');

    var name = dom.data(elem, 'recurly');
    if (!elems[name]) elems[name] = [];
    elems[name].push(elem);
    events.bind(elem, 'change', change);
    events.bind(elem, 'propertychange', change);
  });

  this.attach.detatch = detatch;

  change();

  function change (event) {
    debug('change');

    var targetName = event && event.target && dom.data(event.target, 'recurly');
        targetName = targetName || window.event && window.event.srcElement;

    var pricing = self.plan(dom.value(elems.plan), { quantity: dom.value(elems.plan_quantity) });
    
    if (target('currency')) {
      pricing = pricing.currency(dom.value(elems.currency));
    }

    if (target('addon') && elems.addon) {
      addons();
    }

    if (target('coupon') && elems.coupon) {
      pricing = pricing.coupon(dom.value(elems.coupon)).then(null, ignoreBadCoupons);
    }

    if (target('country') || target('postal_code') || target('vat_number')) {
      pricing = pricing.address({
        country: dom.value(elems.country),
        postal_code: dom.value(elems.postal_code),
        vat_number: dom.value(elems.vat_number)
      });
    }

    pricing.done();

    function addons () {
      each(elems.addon, function (node) {
        var plan = self.items.plan;
        var addonCode = dom.data(node, 'recurlyAddon');
        if (plan.addons && find(plan.addons, { code: addonCode })) {
          pricing = pricing.addon(addonCode, { quantity: dom.value(node) });
        }
      });
    }

    function target (name) {
      if (!targetName) return true;
      if (targetName === name) return true;
      return false
    }
  };

  function update (price) {
    dom.value(elems.currency_code, price.currency.code);
    dom.value(elems.currency_symbol, price.currency.symbol);
    each(['addons', 'discount', 'setup_fee', 'subtotal', 'tax', 'total'], function (value) {
      dom.value(elems[value + '_now'], price.now[value]);
      dom.value(elems[value + '_next'], price.next[value]);
    });
    if (elems.addonPrice) {
      each(elems.addonPrice, function (elem) {
        var addonPrice = price.addons[dom.data(elem, 'recurlyAddon')];
        if (addonPrice) dom.value(elem, addonPrice);
      });
    }
  }

  function detatch () {
    each(elems, function (name, elems) {
      each(elems, function (elem) {
        events.unbind(elem, 'change', change);
        events.unbind(elem, 'propertychange', change);
      }, this);
    }, this);
  }
};

function ignoreBadCoupons (err) {
  if (err.code === 'not-found') return;
  else throw err;
}

/**
 * Backward-compatibility
 *
 * @deprecated
 */

exports.binding = exports.attach;

});








































require.alias("visionmedia-node-querystring/index.js", "recurly/deps/querystring/index.js");
require.alias("visionmedia-node-querystring/index.js", "querystring/index.js");

require.alias("component-emitter/index.js", "recurly/deps/emitter/index.js");
require.alias("component-emitter/index.js", "emitter/index.js");

require.alias("component-indexof/index.js", "recurly/deps/indexof/index.js");
require.alias("component-indexof/index.js", "indexof/index.js");

require.alias("component-object/index.js", "recurly/deps/object/index.js");
require.alias("component-object/index.js", "object/index.js");

require.alias("component-event/index.js", "recurly/deps/event/index.js");
require.alias("component-event/index.js", "event/index.js");

require.alias("component-clone/index.js", "recurly/deps/clone/index.js");
require.alias("component-clone/index.js", "clone/index.js");
require.alias("component-type/index.js", "component-clone/deps/type/index.js");

require.alias("component-bind/index.js", "recurly/deps/bind/index.js");
require.alias("component-bind/index.js", "bind/index.js");

require.alias("component-each/index.js", "recurly/deps/each/index.js");
require.alias("component-each/index.js", "each/index.js");
require.alias("component-to-function/index.js", "component-each/deps/to-function/index.js");
require.alias("component-props/index.js", "component-to-function/deps/props/index.js");

require.alias("component-type/index.js", "component-each/deps/type/index.js");

require.alias("component-find/index.js", "recurly/deps/find/index.js");
require.alias("component-find/index.js", "find/index.js");
require.alias("component-to-function/index.js", "component-find/deps/to-function/index.js");
require.alias("component-props/index.js", "component-to-function/deps/props/index.js");

require.alias("component-json/index.js", "recurly/deps/json/index.js");
require.alias("component-json/index.js", "json/index.js");

require.alias("component-type/index.js", "recurly/deps/type/index.js");
require.alias("component-type/index.js", "type/index.js");

require.alias("component-trim/index.js", "recurly/deps/trim/index.js");
require.alias("component-trim/index.js", "trim/index.js");

require.alias("component-map/index.js", "recurly/deps/map/index.js");
require.alias("component-map/index.js", "map/index.js");
require.alias("component-to-function/index.js", "component-map/deps/to-function/index.js");
require.alias("component-props/index.js", "component-to-function/deps/props/index.js");

require.alias("yields-merge/index.js", "recurly/deps/merge/index.js");
require.alias("yields-merge/index.js", "merge/index.js");

require.alias("learnboost-jsonp/index.js", "recurly/deps/jsonp/index.js");
require.alias("learnboost-jsonp/index.js", "recurly/deps/jsonp/index.js");
require.alias("learnboost-jsonp/index.js", "jsonp/index.js");
require.alias("visionmedia-debug/debug.js", "learnboost-jsonp/deps/debug/debug.js");
require.alias("visionmedia-debug/debug.js", "learnboost-jsonp/deps/debug/index.js");
require.alias("visionmedia-debug/debug.js", "visionmedia-debug/index.js");
require.alias("learnboost-jsonp/index.js", "learnboost-jsonp/index.js");
require.alias("visionmedia-debug/debug.js", "recurly/deps/debug/debug.js");
require.alias("visionmedia-debug/debug.js", "recurly/deps/debug/index.js");
require.alias("visionmedia-debug/debug.js", "debug/index.js");
require.alias("visionmedia-debug/debug.js", "visionmedia-debug/index.js");
require.alias("chrissrogers-promise/index.js", "recurly/deps/promise/index.js");
require.alias("chrissrogers-promise/core.js", "recurly/deps/promise/core.js");
require.alias("chrissrogers-promise/index.js", "promise/index.js");
require.alias("johntron-asap/asap.js", "chrissrogers-promise/deps/asap/asap.js");
require.alias("johntron-asap/asap.js", "chrissrogers-promise/deps/asap/index.js");
require.alias("johntron-asap/asap.js", "johntron-asap/index.js");
require.alias("kewah-mixin/index.js", "recurly/deps/mixin/index.js");
require.alias("kewah-mixin/index.js", "recurly/deps/mixin/index.js");
require.alias("kewah-mixin/index.js", "mixin/index.js");
require.alias("kewah-mixin/index.js", "kewah-mixin/index.js");
require.alias("pluma-par/dist/par.js", "recurly/deps/par/dist/par.js");
require.alias("pluma-par/dist/par.js", "recurly/deps/par/index.js");
require.alias("pluma-par/dist/par.js", "par/index.js");
require.alias("pluma-par/dist/par.js", "pluma-par/index.js");
require.alias("ianstormtaylor-to-slug-case/index.js", "recurly/deps/to-slug-case/index.js");
require.alias("ianstormtaylor-to-slug-case/index.js", "to-slug-case/index.js");
require.alias("ianstormtaylor-to-space-case/index.js", "ianstormtaylor-to-slug-case/deps/to-space-case/index.js");
require.alias("ianstormtaylor-to-no-case/index.js", "ianstormtaylor-to-space-case/deps/to-no-case/index.js");

require.alias("recurly/lib/index.js", "recurly/index.js");if (typeof exports == "object") {
  module.exports = require("recurly");
} else if (typeof define == "function" && define.amd) {
  define([], function(){ return require("recurly"); });
} else {
  this["recurly"] = require("recurly");
}})();