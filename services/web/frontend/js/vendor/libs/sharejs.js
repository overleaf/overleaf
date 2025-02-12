import { generateSHA1Hash } from '../../shared/utils/sha1'
import { debugging, debugConsole } from '@/utils/debugging'
import getMeta from '@/utils/meta'
import { postJSON } from '@/infrastructure/fetch-json'

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/* eslint-disable
    camelcase,
    max-len,
    no-class-assign,
    no-return-assign,
    no-undef,
    no-unused-vars,
    no-use-before-define,
    standard/object-curly-even-spacing,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
export const { Doc } = (() => {
  var append = void 0,
      bootstrapTransform = void 0,
      exports = void 0,
      transformComponent = void 0;
  var WEB = true;
  window.sharejs = exports = {};
  var types = exports.types = {};
  // These methods let you build a transform function from a transformComponent function
  // for OT types like text and JSON in which operations are lists of components
  // and transforming them requires N^2 work.

  // Add transform and transformX functions for an OT type which has transformComponent defined.
  // transformComponent(destination array, component, other component, side)
  exports['_bt'] = bootstrapTransform = function bootstrapTransform(type, transformComponent, checkValidOp, append) {
    var _transformX = void 0;
    var transformComponentX = function transformComponentX(left, right, destLeft, destRight) {
      transformComponent(destLeft, left, right, 'left');
      return transformComponent(destRight, right, left, 'right');
    };

    // Transforms rightOp by leftOp. Returns ['rightOp', clientOp']
    type.transformX = type['transformX'] = _transformX = function transformX(leftOp, rightOp) {
      checkValidOp(leftOp);
      checkValidOp(rightOp);

      var newRightOp = [];

      var _iteratorNormalCompletion = true;
      var _didIteratorError = false;
      var _iteratorError = undefined;

      try {
        for (var _iterator = Array.from(rightOp)[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
          var rightComponent = _step.value;

          // Generate newLeftOp by composing leftOp by rightComponent
          var newLeftOp = [];

          var k = 0;
          while (k < leftOp.length) {
            var l;
            var nextC = [];
            transformComponentX(leftOp[k], rightComponent, newLeftOp, nextC);
            k++;

            if (nextC.length === 1) {
              rightComponent = nextC[0];
            } else if (nextC.length === 0) {
              var _iteratorNormalCompletion2 = true;
              var _didIteratorError2 = false;
              var _iteratorError2 = undefined;

              try {
                for (var _iterator2 = Array.from(leftOp.slice(k))[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
                  l = _step2.value;
                  append(newLeftOp, l);
                }
              } catch (err) {
                _didIteratorError2 = true;
                _iteratorError2 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion2 && _iterator2.return) {
                    _iterator2.return();
                  }
                } finally {
                  if (_didIteratorError2) {
                    throw _iteratorError2;
                  }
                }
              }

              rightComponent = null;
              break;
            } else {
              // Recurse.
              var _Array$from = Array.from(_transformX(leftOp.slice(k), nextC)),
                  _Array$from2 = _slicedToArray(_Array$from, 2),
                  l_ = _Array$from2[0],
                  r_ = _Array$from2[1];

              var _iteratorNormalCompletion3 = true;
              var _didIteratorError3 = false;
              var _iteratorError3 = undefined;

              try {
                for (var _iterator3 = Array.from(l_)[Symbol.iterator](), _step3; !(_iteratorNormalCompletion3 = (_step3 = _iterator3.next()).done); _iteratorNormalCompletion3 = true) {
                  l = _step3.value;
                  append(newLeftOp, l);
                }
              } catch (err) {
                _didIteratorError3 = true;
                _iteratorError3 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion3 && _iterator3.return) {
                    _iterator3.return();
                  }
                } finally {
                  if (_didIteratorError3) {
                    throw _iteratorError3;
                  }
                }
              }

              var _iteratorNormalCompletion4 = true;
              var _didIteratorError4 = false;
              var _iteratorError4 = undefined;

              try {
                for (var _iterator4 = Array.from(r_)[Symbol.iterator](), _step4; !(_iteratorNormalCompletion4 = (_step4 = _iterator4.next()).done); _iteratorNormalCompletion4 = true) {
                  var r = _step4.value;
                  append(newRightOp, r);
                }
              } catch (err) {
                _didIteratorError4 = true;
                _iteratorError4 = err;
              } finally {
                try {
                  if (!_iteratorNormalCompletion4 && _iterator4.return) {
                    _iterator4.return();
                  }
                } finally {
                  if (_didIteratorError4) {
                    throw _iteratorError4;
                  }
                }
              }

              rightComponent = null;
              break;
            }
          }

          if (rightComponent != null) {
            append(newRightOp, rightComponent);
          }
          leftOp = newLeftOp;
        }
      } catch (err) {
        _didIteratorError = true;
        _iteratorError = err;
      } finally {
        try {
          if (!_iteratorNormalCompletion && _iterator.return) {
            _iterator.return();
          }
        } finally {
          if (_didIteratorError) {
            throw _iteratorError;
          }
        }
      }

      return [leftOp, newRightOp];
    };

    // Transforms op with specified type ('left' or 'right') by otherOp.
    return type.transform = type['transform'] = function (op, otherOp, type) {
      var _ = void 0;
      if (type !== 'left' && type !== 'right') {
        throw new Error("type must be 'left' or 'right'");
      }

      if (otherOp.length === 0) {
        return op;
      }

      // TODO: Benchmark with and without this line. I _think_ it'll make a big difference...?
      if (op.length === 1 && otherOp.length === 1) {
        return transformComponent([], op[0], otherOp[0], type);
      }

      if (type === 'left') {
        var left = void 0;

        var _Array$from3 = Array.from(_transformX(op, otherOp));

        var _Array$from4 = _slicedToArray(_Array$from3, 2);

        left = _Array$from4[0];
        _ = _Array$from4[1];

        return left;
      } else {
        var right = void 0;

        var _Array$from5 = Array.from(_transformX(otherOp, op));

        var _Array$from6 = _slicedToArray(_Array$from5, 2);

        _ = _Array$from6[0];
        right = _Array$from6[1];

        return right;
      }
    };
  };

  // A simple text implementation
  //
  // Operations are lists of components.
  // Each component either inserts or deletes at a specified position in the document.
  //
  // Components are either:
  //  {i:'str', p:100}: Insert 'str' at position 100 in the document
  //  {d:'str', p:100}: Delete 'str' at position 100 in the document
  //
  // Components in an operation are executed sequentially, so the position of components
  // assumes previous components have already executed.
  //
  // Eg: This op:
  //   [{i:'abc', p:0}]
  // is equivalent to this op:
  //   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

  // NOTE: The global scope here is shared with other sharejs files when built with closure.
  // Be careful what ends up in your namespace.

  var text = {};

  text.name = 'text';

  text.create = function () {
    return '';
  };

  var strInject = function strInject(s1, pos, s2) {
    return s1.slice(0, pos) + s2 + s1.slice(pos);
  };

  var checkValidComponent = function checkValidComponent(c) {
    if (typeof c.p !== 'number') {
      throw new Error('component missing position field');
    }

    var i_type = _typeof(c.i);
    var d_type = _typeof(c.d);
    var c_type = _typeof(c.c);
    if (!(i_type === 'string' ^ d_type === 'string' ^ c_type === 'string')) {
      throw new Error('component needs an i, d or c field');
    }

    if (!(c.p >= 0)) {
      throw new Error('position cannot be negative');
    }
  };

  var checkValidOp = function checkValidOp(op) {
    var _iteratorNormalCompletion5 = true;
    var _didIteratorError5 = false;
    var _iteratorError5 = undefined;

    try {
      for (var _iterator5 = Array.from(op)[Symbol.iterator](), _step5; !(_iteratorNormalCompletion5 = (_step5 = _iterator5.next()).done); _iteratorNormalCompletion5 = true) {
        var c = _step5.value;
        checkValidComponent(c);
      }
    } catch (err) {
      _didIteratorError5 = true;
      _iteratorError5 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion5 && _iterator5.return) {
          _iterator5.return();
        }
      } finally {
        if (_didIteratorError5) {
          throw _iteratorError5;
        }
      }
    }

    return true;
  };

  text.apply = function (snapshot, op) {
    checkValidOp(op);
    var _iteratorNormalCompletion6 = true;
    var _didIteratorError6 = false;
    var _iteratorError6 = undefined;

    try {
      for (var _iterator6 = Array.from(op)[Symbol.iterator](), _step6; !(_iteratorNormalCompletion6 = (_step6 = _iterator6.next()).done); _iteratorNormalCompletion6 = true) {
        var component = _step6.value;

        if (component.i != null) {
          snapshot = strInject(snapshot, component.p, component.i);
        } else if (component.d != null) {
          var deleted = snapshot.slice(component.p, component.p + component.d.length);
          if (component.d !== deleted) {
            throw new Error('Delete component \'' + component.d + '\' does not match deleted text \'' + deleted + '\'');
          }
          snapshot = snapshot.slice(0, component.p) + snapshot.slice(component.p + component.d.length);
        } else if (component.c != null) {
          var comment = snapshot.slice(component.p, component.p + component.c.length);
          if (component.c !== comment) {
            throw new Error('Comment component \'' + component.c + '\' does not match commented text \'' + comment + '\'');
          }
        } else {
          throw new Error('Unknown op type');
        }
      }
    } catch (err) {
      _didIteratorError6 = true;
      _iteratorError6 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion6 && _iterator6.return) {
          _iterator6.return();
        }
      } finally {
        if (_didIteratorError6) {
          throw _iteratorError6;
        }
      }
    }

    return snapshot;
  };

  var cloneAndModify = function cloneAndModify(op, modifications) {
    var v = void 0;
    var newOp = {};
    for (var k in op) {
      v = op[k];
      newOp[k] = v;
    }
    for (k in modifications) {
      v = modifications[k];
      newOp[k] = v;
    }
    return newOp;
  };

  // Exported for use by the random op generator.
  //
  // For simplicity, this version of append does not compress adjacent inserts and deletes of
  // the same text. It would be nice to change that at some stage.
  text._append = append = function append(newOp, c) {
    if (c.i === '' || c.d === '') {
      return;
    }
    if (newOp.length === 0) {
      return newOp.push(c);
    } else {
      var last = newOp[newOp.length - 1];

      // Compose the insert into the previous insert if possible
      if (last.i != null && c.i != null && last.p <= c.p && c.p <= last.p + last.i.length && last.u === c.u) {
        return newOp[newOp.length - 1] = cloneAndModify(last, { i: strInject(last.i, c.p - last.p, c.i) });
      } else if (last.d != null && c.d != null && c.p <= last.p && last.p <= c.p + c.d.length && last.u === c.u) {
        return newOp[newOp.length - 1] = cloneAndModify(last, { d: strInject(c.d, last.p - c.p, last.d), p: c.p });
      } else {
        return newOp.push(c);
      }
    }
  };

  text.compose = function (op1, op2) {
    checkValidOp(op1);
    checkValidOp(op2);

    var newOp = op1.slice();
    var _iteratorNormalCompletion7 = true;
    var _didIteratorError7 = false;
    var _iteratorError7 = undefined;

    try {
      for (var _iterator7 = Array.from(op2)[Symbol.iterator](), _step7; !(_iteratorNormalCompletion7 = (_step7 = _iterator7.next()).done); _iteratorNormalCompletion7 = true) {
        var c = _step7.value;
        append(newOp, c);
      }
    } catch (err) {
      _didIteratorError7 = true;
      _iteratorError7 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion7 && _iterator7.return) {
          _iterator7.return();
        }
      } finally {
        if (_didIteratorError7) {
          throw _iteratorError7;
        }
      }
    }

    return newOp;
  };

  // Attempt to compress the op components together 'as much as possible'.
  // This implementation preserves order and preserves create/delete pairs.
  text.compress = function (op) {
    return text.compose([], op);
  };

  text.normalize = function (op) {
    var newOp = [];

    // Normalize should allow ops which are a single (unwrapped) component:
    // {i:'asdf', p:23}.
    // There's no good way to test if something is an array:
    // http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
    // so this is probably the least bad solution.
    if (op.i != null || op.p != null) {
      op = [op];
    }

    var _iteratorNormalCompletion8 = true;
    var _didIteratorError8 = false;
    var _iteratorError8 = undefined;

    try {
      for (var _iterator8 = Array.from(op)[Symbol.iterator](), _step8; !(_iteratorNormalCompletion8 = (_step8 = _iterator8.next()).done); _iteratorNormalCompletion8 = true) {
        var c = _step8.value;

        if (c.p == null) {
          c.p = 0;
        }
        append(newOp, c);
      }
    } catch (err) {
      _didIteratorError8 = true;
      _iteratorError8 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion8 && _iterator8.return) {
          _iterator8.return();
        }
      } finally {
        if (_didIteratorError8) {
          throw _iteratorError8;
        }
      }
    }

    return newOp;
  };

  // This helper method transforms a position by an op component.
  //
  // If c is an insert, insertAfter specifies whether the transform
  // is pushed after the insert (true) or before it (false).
  //
  // insertAfter is optional for deletes.
  var transformPosition = function transformPosition(pos, c, insertAfter) {
    if (c.i != null) {
      if (c.p < pos || c.p === pos && insertAfter) {
        return pos + c.i.length;
      } else {
        return pos;
      }
    } else if (c.d != null) {
      // I think this could also be written as: Math.min(c.p, Math.min(c.p - otherC.p, otherC.d.length))
      // but I think its harder to read that way, and it compiles using ternary operators anyway
      // so its no slower written like this.
      if (pos <= c.p) {
        return pos;
      } else if (pos <= c.p + c.d.length) {
        return c.p;
      } else {
        return pos - c.d.length;
      }
    } else if (c.c != null) {
      return pos;
    } else {
      throw new Error('unknown op type');
    }
  };

  // Helper method to transform a cursor position as a result of an op.
  //
  // Like transformPosition above, if c is an insert, insertAfter specifies whether the cursor position
  // is pushed after an insert (true) or before it (false).
  text.transformCursor = function (position, op, side) {
    var insertAfter = side === 'right';
    var _iteratorNormalCompletion9 = true;
    var _didIteratorError9 = false;
    var _iteratorError9 = undefined;

    try {
      for (var _iterator9 = Array.from(op)[Symbol.iterator](), _step9; !(_iteratorNormalCompletion9 = (_step9 = _iterator9.next()).done); _iteratorNormalCompletion9 = true) {
        var c = _step9.value;
        position = transformPosition(position, c, insertAfter);
      }
    } catch (err) {
      _didIteratorError9 = true;
      _iteratorError9 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion9 && _iterator9.return) {
          _iterator9.return();
        }
      } finally {
        if (_didIteratorError9) {
          throw _iteratorError9;
        }
      }
    }

    return position;
  };

  // Transform an op component by another op component. Asymmetric.
  // The result will be appended to destination.
  //
  // exported for use in JSON type
  text._tc = transformComponent = function transformComponent(dest, c, otherC, side) {
    var cIntersect = void 0,
        intersectEnd = void 0,
        intersectStart = void 0,
        newC = void 0,
        otherIntersect = void 0;
    checkValidOp([c]);
    checkValidOp([otherC]);

    if (c.i != null) {
      append(dest, cloneAndModify(c, { p: transformPosition(c.p, otherC, side === 'right') }));
    } else if (c.d != null) {
      // Delete
      if (otherC.i != null) {
        // delete vs insert
        var s = c.d;
        if (c.p < otherC.p) {
          append(dest, cloneAndModify(c, { d: s.slice(0, otherC.p - c.p) }));
          s = s.slice(otherC.p - c.p);
        }
        if (s !== '') {
          append(dest, cloneAndModify(c, { d: s, p: c.p + otherC.i.length }));
        }
      } else if (otherC.d != null) {
        // Delete vs delete
        if (c.p >= otherC.p + otherC.d.length) {
          append(dest, cloneAndModify(c, { p: c.p - otherC.d.length }));
        } else if (c.p + c.d.length <= otherC.p) {
          append(dest, c);
        } else {
          // They overlap somewhere.
          newC = cloneAndModify(c, { d: '' });
          if (c.p < otherC.p) {
            newC.d = c.d.slice(0, otherC.p - c.p);
          }
          if (c.p + c.d.length > otherC.p + otherC.d.length) {
            newC.d += c.d.slice(otherC.p + otherC.d.length - c.p);
          }

          // This is entirely optional - just for a check that the deleted
          // text in the two ops matches
          intersectStart = Math.max(c.p, otherC.p);
          intersectEnd = Math.min(c.p + c.d.length, otherC.p + otherC.d.length);
          cIntersect = c.d.slice(intersectStart - c.p, intersectEnd - c.p);
          otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
          if (cIntersect !== otherIntersect) {
            throw new Error('Delete ops delete different text in the same region of the document');
          }

          if (newC.d !== '') {
            // This could be rewritten similarly to insert v delete, above.
            newC.p = transformPosition(newC.p, otherC);
            append(dest, newC);
          }
        }
      } else if (otherC.c != null) {
        append(dest, c);
      } else {
        throw new Error('unknown op type');
      }
    } else if (c.c != null) {
      // Comment
      if (otherC.i != null) {
        if (c.p < otherC.p && otherC.p < c.p + c.c.length) {
          var offset = otherC.p - c.p;
          var new_c = c.c.slice(0, +(offset - 1) + 1 || undefined) + otherC.i + c.c.slice(offset);
          append(dest, cloneAndModify(c, { c: new_c }));
        } else {
          append(dest, cloneAndModify(c, { p: transformPosition(c.p, otherC, true) }));
        }
      } else if (otherC.d != null) {
        if (c.p >= otherC.p + otherC.d.length) {
          append(dest, cloneAndModify(c, { p: c.p - otherC.d.length }));
        } else if (c.p + c.c.length <= otherC.p) {
          append(dest, c);
        } else {
          // Delete overlaps comment
          // They overlap somewhere.
          newC = cloneAndModify(c, { c: '' });
          if (c.p < otherC.p) {
            newC.c = c.c.slice(0, otherC.p - c.p);
          }
          if (c.p + c.c.length > otherC.p + otherC.d.length) {
            newC.c += c.c.slice(otherC.p + otherC.d.length - c.p);
          }

          // This is entirely optional - just for a check that the deleted
          // text in the two ops matches
          intersectStart = Math.max(c.p, otherC.p);
          intersectEnd = Math.min(c.p + c.c.length, otherC.p + otherC.d.length);
          cIntersect = c.c.slice(intersectStart - c.p, intersectEnd - c.p);
          otherIntersect = otherC.d.slice(intersectStart - otherC.p, intersectEnd - otherC.p);
          if (cIntersect !== otherIntersect) {
            throw new Error('Delete ops delete different text in the same region of the document');
          }

          newC.p = transformPosition(newC.p, otherC);
          append(dest, newC);
        }
      } else if (otherC.c != null) {
        append(dest, c);
      } else {
        throw new Error('unknown op type');
      }
    }

    return dest;
  };

  var invertComponent = function invertComponent(c) {
    if (c.i != null) {
      return { d: c.i, p: c.p };
    } else {
      return { i: c.d, p: c.p };
    }
  };

  // No need to use append for invert, because the components won't be able to
  // cancel with one another.
  text.invert = function (op) {
    return Array.from(op.slice().reverse()).map(function (c) {
      return invertComponent(c);
    });
  };

  if (WEB != null) {
    if (!exports.types) {
      exports.types = {};
    }

    // This is kind of awful - come up with a better way to hook this helper code up.
    bootstrapTransform(text, transformComponent, checkValidOp, append);

    // [] is used to prevent closure from renaming types.text
    exports.types.text = text;
  }

  // Text document API for text

  text.api = {
    provides: { text: true },

    // The number of characters in the string
    getLength: function getLength() {
      return this.snapshot.length;
    },


    // Get the text contents of a document
    getText: function getText() {
      return this.snapshot;
    },
    insert: function insert(pos, text, fromUndo, callback) {
      var op = { p: pos, i: text };
      if (fromUndo) {
        op.u = true;
        // TODO: This flag is temporary. It is only necessary while we change
        // the behaviour of tracked delete rejections in RangesTracker
        op.fixedRemoveChange = true;
      }
      op = [op];

      this.submitOp(op, callback);
      return op;
    },
    del: function del(pos, length, fromUndo, callback) {
      var op = { p: pos, d: this.snapshot.slice(pos, pos + length) };
      if (fromUndo) {
        op.u = true;
      }
      op = [op];

      this.submitOp(op, callback);
      return op;
    },
    _register: function _register() {
      return this.on('remoteop', function (op) {
        var _this = this;

        return function () {
          var result = [];
          var _iteratorNormalCompletion10 = true;
          var _didIteratorError10 = false;
          var _iteratorError10 = undefined;

          try {
            for (var _iterator10 = Array.from(op)[Symbol.iterator](), _step10; !(_iteratorNormalCompletion10 = (_step10 = _iterator10.next()).done); _iteratorNormalCompletion10 = true) {
              var component = _step10.value;

              if (component.i !== undefined) {
                result.push(_this.emit('insert', component.p, component.i));
              } else if (component.d !== undefined) {
                result.push(_this.emit('delete', component.p, component.d));
              } else {
                result.push(undefined);
              }
            }
          } catch (err) {
            _didIteratorError10 = true;
            _iteratorError10 = err;
          } finally {
            try {
              if (!_iteratorNormalCompletion10 && _iterator10.return) {
                _iterator10.return();
              }
            } finally {
              if (_didIteratorError10) {
                throw _iteratorError10;
              }
            }
          }

          return result;
        }();
      });
    }
  };
  // This is a simple port of microevent.js to Coffeescript. I've changed the
  // function names to be consistent with node.js EventEmitter.
  //
  // microevent.js is copyright Jerome Etienne, and licensed under the MIT license:
  // https://github.com/jeromeetienne/microevent.js

  var nextTick = WEB != null ? function (fn) {
    return setTimeout(fn, 0);
  } : process['nextTick'];

  var MicroEvent = function () {
    function MicroEvent() {
      _classCallCheck(this, MicroEvent);
    }

    _createClass(MicroEvent, [{
      key: 'on',
      value: function on(event, fct) {
        if (!this._events) {
          this._events = {};
        }
        if (!this._events[event]) {
          this._events[event] = [];
        }
        this._events[event].push(fct);
        return this;
      }
    }, {
      key: 'removeListener',
      value: function removeListener(event, fct) {
        var _this2 = this;

        if (!this._events) {
          this._events = {};
        }
        var listeners = this._events[event] || (this._events[event] = []);

        // Sadly, there's no IE8- support for indexOf.
        var i = 0;
        while (i < listeners.length) {
          if (listeners[i] === fct) {
            listeners[i] = undefined;
          }
          i++;
        }

        nextTick(function () {
          return _this2._events[event] = Array.from(_this2._events[event]).filter(function (x) {
            return x;
          });
        });

        return this;
      }
    }, {
      key: 'emit',
      value: function emit(event) {
        if (!(this._events != null ? this._events[event] : undefined)) {
          return this;
        }

        for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
          args[_key - 1] = arguments[_key];
        }

        var _iteratorNormalCompletion11 = true;
        var _didIteratorError11 = false;
        var _iteratorError11 = undefined;

        try {
          for (var _iterator11 = Array.from(this._events[event])[Symbol.iterator](), _step11; !(_iteratorNormalCompletion11 = (_step11 = _iterator11.next()).done); _iteratorNormalCompletion11 = true) {
            var fn = _step11.value;
            if (fn) {
              fn.apply(this, args);
            }
          }
        } catch (err) {
          _didIteratorError11 = true;
          _iteratorError11 = err;
        } finally {
          try {
            if (!_iteratorNormalCompletion11 && _iterator11.return) {
              _iterator11.return();
            }
          } finally {
            if (_didIteratorError11) {
              throw _iteratorError11;
            }
          }
        }

        return this;
      }
    }]);

    return MicroEvent;
  }();

  // mixin will delegate all MicroEvent.js function in the destination object


  MicroEvent.mixin = function (obj) {
    var proto = obj.prototype || obj;

    // Damn closure compiler :/
    proto.on = MicroEvent.prototype.on;
    proto.removeListener = MicroEvent.prototype.removeListener;
    proto.emit = MicroEvent.prototype.emit;
    return obj;
  };

  if (WEB == null) {
    module.exports = MicroEvent;
  }

  if (WEB != null) {
    exports.extendDoc = function (name, fn) {
      return Doc.prototype[name] = fn;
    };
  }

  // A Doc is a client's view on a sharejs document.
  //
  // Documents are created by calling Connection.open().
  //
  // Documents are event emitters - use doc.on(eventname, fn) to subscribe.
  //
  // Documents get mixed in with their type's API methods. So, you can .insert('foo', 0) into
  // a text document and stuff like that.
  //
  // Events:
  //  - remoteop (op)
  //  - changed (op)
  //  - acknowledge (op)
  //  - error
  //  - open, closing, closed. 'closing' is not guaranteed to fire before closed.

  var Doc = function () {
    // connection is a Connection object.
    // name is the documents' docName.
    // data can optionally contain known document data, and initial open() call arguments:
    // {v[erson], snapshot={...}, type, create=true/false/undefined}
    // callback will be called once the document is first opened.
    function Doc(connection, name, openData) {
      _classCallCheck(this, Doc);

      // Any of these can be null / undefined at this stage.
      this.flush = this.flush.bind(this);
      this.setFlushDelay = this.setFlushDelay.bind(this);
      this.shout = this.shout.bind(this);
      this.connection = connection;
      this.name = name;
      if (!openData) {
        openData = {};
      }
      this.version = openData.v;
      this.lastServerActivity = performance.now()
      this.snapshot = openData.snaphot;
      if (openData.type) {
        this._setType(openData.type);
      }

      this.state = 'closed';
      this.autoOpen = false;

      // Has the document already been created?
      this._create = openData.create;

      // The op that is currently roundtripping to the server, or null.
      //
      // When the connection reconnects, the inflight op is resubmitted.
      this.inflightOp = null;
      this.inflightCallbacks = [];
      // The auth ids which the client has previously used to attempt to send inflightOp. This is
      // usually empty.
      this.inflightSubmittedIds = [];

      // All ops that are waiting for the server to acknowledge @inflightOp
      this.pendingOp = null;
      this.pendingCallbacks = [];
    }

    // Transform a server op by a client op, and vice versa.


    _createClass(Doc, [{
      key: '_xf',
      value: function _xf(client, server) {
        if (this.type.transformX) {
          return this.type.transformX(client, server);
        } else {
          var client_ = this.type.transform(client, server, 'left');
          var server_ = this.type.transform(server, client, 'right');
          return [client_, server_];
        }
      }
    }, {
      key: '_otApply',
      value: function _otApply(docOp, isRemote, msg) {
        var oldSnapshot = this.snapshot;
        this.snapshot = this.type.apply(this.snapshot, docOp);

        // Its important that these event handlers are called with oldSnapshot.
        // The reason is that the OT type APIs might need to access the snapshots to
        // determine information about the received op.
        this.emit('change', docOp, oldSnapshot, msg);
        if (isRemote) {
          return this.emit('remoteop', docOp, oldSnapshot, msg);
        }
      }
    }, {
      key: '_connectionStateChanged',
      value: function _connectionStateChanged(state, data) {
        switch (state) {
          case 'disconnected':
            this.state = 'closed';
            // This is used by the server to make sure that when an op is resubmitted it
            // doesn't end up getting applied twice.
            if (this.inflightOp) {
              this.inflightSubmittedIds.push(this.connection.id);
            }

            this.emit('closed');
            break;

          case 'ok':
            // Might be able to do this when we're connecting... that would save a roundtrip.
            if (this.autoOpen) {
              this.open();
            }
            break;

          case 'stopped':
            if (typeof this._openCallback === 'function') {
              this._openCallback(data);
            }
            break;
        }

        return this.emit(state, data);
      }
    }, {
      key: '_setType',
      value: function _setType(type) {
        if (typeof type === 'string') {
          type = types[type];
        }

        if (!type || !type.compose) {
          throw new Error('Support for types without compose() is not implemented');
        }

        this.type = type;
        if (type.api) {
          for (var k in type.api) {
            var v = type.api[k];this[k] = v;
          }
          return typeof this._register === 'function' ? this._register() : undefined;
        } else {
          return this.provides = {};
        }
      }
    }, {
      key: '_onMessage',
      value: function _onMessage(msg) {
        // debugConsole.warn('s->c', msg)
        if (msg.open === true) {
          // The document has been successfully opened.
          this.state = 'open';
          this._create = false; // Don't try and create the document again next time open() is called.
          if (this.created == null) {
            this.created = !!msg.create;
          }

          if (msg.type) {
            this._setType(msg.type);
          }
          if (msg.create) {
            this.created = true;
            this.snapshot = this.type.create();
          } else {
            if (this.created !== true) {
              this.created = false;
            }
            if (msg.snapshot !== undefined) {
              this.snapshot = msg.snapshot;
            }
          }

          if (msg.v != null) {
            this.version = msg.v;
          }

          // Resend any previously queued operation.
          if (this.inflightOp) {
            var response = {
              doc: this.name,
              op: this.inflightOp,
              v: this.version
            };
            if (this.inflightSubmittedIds.length) {
              response.dupIfSource = this.inflightSubmittedIds;
            }
            this.connection.send(response);
          } else {
            this.flush();
          }

          this.emit('open');

          return typeof this._openCallback === 'function' ? this._openCallback(null) : undefined;
        } else if (msg.open === false) {
          // The document has either been closed, or an open request has failed.
          if (msg.error) {
            // An error occurred opening the document.
            debugConsole.error('Could not open document: ' + msg.error);
            this.emit('error', msg.error);
            if (typeof this._openCallback === 'function') {
              this._openCallback(msg.error);
            }
          }

          this.state = 'closed';
          this.emit('closed');

          if (typeof this._closeCallback === 'function') {
            this._closeCallback();
          }
          return this._closeCallback = null;
        } else if (msg.op === null && error === 'Op already submitted') {
          // Overleaf: note that this branch is never reached, as `error` is always undefined

          // We've tried to resend an op to the server, which has already been received successfully. Do nothing.
          // The op will be confirmed normally when we get the op itself was echoed back from the server
          // (handled below).

        } else if (msg.op === undefined && msg.v !== undefined || msg.op && Array.from(this.inflightSubmittedIds).includes(msg.meta.source)) {
          // Overleaf: avoid clearing inflightOp on repeated acknowledgement of operations on the same version
          if (!msg.error) {
            if (msg.op === undefined && msg.v !== undefined) {
              if (msg.v < this.version) {
                postJSON('/error/client', {
                  body: {
                    error: {
                      message: 'out-of-order-ack-ignored'
                    },
                    meta: { msg, version: this.version }
                  }
                })
                return
              }
            } else {
              if (msg.v < this.version) {
                postJSON('/error/client', {
                  body: {
                    error: {
                      message: 'out-of-order-self-op-ignored'
                    },
                    meta: { msg: { v: msg.v }, version: this.version }
                  }
                })
                // return // TODO: enable this?
              }
            }
          }

          // Our inflight op has been acknowledged.
          var callback = void 0;
          var oldInflightOp = this.inflightOp;
          this.inflightOp = null;
          this.inflightSubmittedIds.length = 0;

          if (this.pendingOp === null) {
            // All ops are acked
            this.emit('saved');
          }

          var error = msg.error;

          if (error) {
            // The server has rejected an op from the client for some reason.
            // We'll send the error message to the user and roll back the change.
            //
            // If the server isn't going to allow edits anyway, we should probably
            // figure out some way to flag that (readonly:true in the open request?)

            if (this.type.invert) {
              var undo = this.type.invert(oldInflightOp);

              // Now we have to transform the undo operation by any server ops & pending ops
              if (this.pendingOp) {
                var _Array$from7 = Array.from(this._xf(this.pendingOp, undo));

                var _Array$from8 = _slicedToArray(_Array$from7, 2);

                this.pendingOp = _Array$from8[0];
                undo = _Array$from8[1];
              }

              // ... and apply it locally, reverting the changes.
              //
              // This call will also call @emit 'remoteop'. I'm still not 100% sure about this
              // functionality, because its really a local op. Basically, the problem is that
              // if the client's op is rejected by the server, the editor window should update
              // to reflect the undo.
              this._otApply(undo, true, msg);
            } else {
              this.emit('error', 'Op apply failed (' + error + ') and the op could not be reverted');
            }

            var _iteratorNormalCompletion12 = true;
            var _didIteratorError12 = false;
            var _iteratorError12 = undefined;

            try {
              for (var _iterator12 = Array.from(this.inflightCallbacks)[Symbol.iterator](), _step12; !(_iteratorNormalCompletion12 = (_step12 = _iterator12.next()).done); _iteratorNormalCompletion12 = true) {
                callback = _step12.value;
                callback(error);
              }
            } catch (err) {
              _didIteratorError12 = true;
              _iteratorError12 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion12 && _iterator12.return) {
                  _iterator12.return();
                }
              } finally {
                if (_didIteratorError12) {
                  throw _iteratorError12;
                }
              }
            }
          } else {
            // The op applied successfully.

            // We may get multiple acks of the same message if we retried it,
            // so its ok if we receive an ack for a version that we've already gone past.
            // If so, just ignore it
            if (msg.v < this.version) {
              return;
            }

            if (msg.v !== this.version) {
              throw new Error('Invalid version from server');
            }

            this.version++;
            this.lastServerActivity = performance.now()
            this.emit('acknowledge', oldInflightOp);
            var _iteratorNormalCompletion13 = true;
            var _didIteratorError13 = false;
            var _iteratorError13 = undefined;

            try {
              for (var _iterator13 = Array.from(this.inflightCallbacks)[Symbol.iterator](), _step13; !(_iteratorNormalCompletion13 = (_step13 = _iterator13.next()).done); _iteratorNormalCompletion13 = true) {
                callback = _step13.value;
                callback(null, oldInflightOp);
              }
            } catch (err) {
              _didIteratorError13 = true;
              _iteratorError13 = err;
            } finally {
              try {
                if (!_iteratorNormalCompletion13 && _iterator13.return) {
                  _iterator13.return();
                }
              } finally {
                if (_didIteratorError13) {
                  throw _iteratorError13;
                }
              }
            }
          }

          // Send the next op.
          return this.delayedFlush();
        } else if (msg.op) {
          // We got a new op from the server.
          // msg is {doc:, op:, v:}

          // There is a bug in socket.io (produced on firefox 3.6) which causes messages
          // to be duplicated sometimes.
          // We'll just silently drop subsequent messages.
          if (msg.v < this.version) {
            return;
          }

          if (msg.doc !== this.name) {
            return this.emit('error', 'Expected docName \'' + this.name + '\' but got ' + msg.doc);
          }
          if (msg.v !== this.version) {
            return this.emit('error', 'Expected version ' + this.version + ' but got ' + msg.v);
          }

          //    p "if: #{i @inflightOp} pending: #{i @pendingOp} doc '#{@snapshot}' op: #{i msg.op}"

          var docOp = msg.op;
          if (this.inflightOp !== null) {
            var _Array$from9 = Array.from(this._xf(this.inflightOp, docOp));

            var _Array$from10 = _slicedToArray(_Array$from9, 2);

            this.inflightOp = _Array$from10[0];
            docOp = _Array$from10[1];
          }
          if (this.pendingOp !== null) {
            var _Array$from11 = Array.from(this._xf(this.pendingOp, docOp));

            var _Array$from12 = _slicedToArray(_Array$from11, 2);

            this.pendingOp = _Array$from12[0];
            docOp = _Array$from12[1];
          }

          this.version++;
          this.lastServerActivity = performance.now()
          // Finally, apply the op to @snapshot and trigger any event listeners
          return this._otApply(docOp, true, msg);
        } else if (msg.meta) {
          var _msg$meta = msg.meta,
              path = _msg$meta.path,
              value = _msg$meta.value;


          switch (path != null ? path[0] : undefined) {
            case 'shout':
              return this.emit('shout', value);
            default:
              return debugConsole.warn('Unhandled meta op:', msg);
          }
        } else {
          return debugConsole.warn('Unhandled document message:', msg);
        }
      }

      // Send ops to the server, if appropriate.
      //
      // Only one op can be in-flight at a time, so if an op is already on its way then
      // this method does nothing.

    }, {
      key: 'flush',
      value: function flush() {
        this.flushTimeout = null;
        // console.log "CALLED FLUSH"

        if (this.connection.state !== 'ok' || this.inflightOp !== null || this.pendingOp === null) {
          return;
        }

        // Rotate null -> pending -> inflight
        this.inflightOp = this.pendingOp;
        this.inflightCallbacks = this.pendingCallbacks;

        this.pendingOp = null;
        this.pendingCallbacks = [];

        this.emit('flipped_pending_to_inflight');

        if (getMeta('ol-useShareJsHash') || debugging) {
          var now = Date.now()
          var age = this.__lastSubmitTimestamp && (now - this.__lastSubmitTimestamp)
          var RECOMPUTE_HASH_INTERVAL = 5000
          // check the document hash regularly (but not if we have checked in the last 5 seconds)
          var needToRecomputeHash = !this.__lastSubmitTimestamp || (age > RECOMPUTE_HASH_INTERVAL) || (age < 0)
          if (needToRecomputeHash || debugging) {
            // send git hash of current snapshot
            var sha1 = generateSHA1Hash("blob " + this.snapshot.length + "\x00" + this.snapshot)
            this.__lastSubmitTimestamp = now;
          }
        }

        // console.log "SENDING OP TO SERVER", @inflightOp, @version
        var lastVersion = this.__lastVersion;
        this.__lastVersion = this.version;
        return this.connection.send({ doc: this.name, op: this.inflightOp, v: this.version, lastV: lastVersion, hash: sha1});
      }

      // Submit an op to the server. The op maybe held for a little while before being sent, as only one
      // op can be inflight at any time.

    }, {
      key: 'submitOp',
      value: function submitOp(op, callback) {
        if (this.type.normalize != null) {
          op = this.type.normalize(op);
        }

        var oldSnapshot = this.snapshot;
        // If this throws an exception, no changes should have been made to the doc
        this.snapshot = this.type.apply(this.snapshot, op);

        if (this.pendingOp !== null) {
          this.pendingOp = this.type.compose(this.pendingOp, op);
        } else {
          this.pendingOp = op;
        }

        if (callback) {
          this.pendingCallbacks.push(callback);
        }

        this.emit('change', op, oldSnapshot);

        return this.delayedFlush();
      }
    }, {
      key: 'delayedFlush',
      value: function delayedFlush() {
        if (this.flushTimeout == null) {
          return this.flushTimeout = setTimeout(this.flush, this._flushDelay || 0);
        }
      }
    }, {
      key: 'setFlushDelay',
      value: function setFlushDelay(delay) {
        return this._flushDelay = delay;
      }
    }, {
      key: 'shout',
      value: function shout(msg) {
        // Meta ops don't have to queue, they can go direct. Good/bad idea?
        return this.connection.send({ doc: this.name, meta: { path: ['shout'], value: msg } });
      }

      // Open a document. The document starts closed.

    }, {
      key: 'open',
      value: function open(callback) {
        var _this3 = this;

        this.autoOpen = true;
        if (this.state !== 'closed') {
          return;
        }

        var message = {
          doc: this.name,
          open: true
        };

        if (this.snapshot === undefined) {
          message.snapshot = null;
        }
        if (this.type) {
          message.type = this.type.name;
        }
        if (this.version != null) {
          message.v = this.version;
        }
        if (this._create) {
          message.create = true;
        }

        this.connection.send(message);

        this.state = 'opening';

        return this._openCallback = function (error) {
          _this3._openCallback = null;
          return typeof callback === 'function' ? callback(error) : undefined;
        };
      }

      // Close a document.

    }, {
      key: 'close',
      value: function close(callback) {
        this.autoOpen = false;
        if (this.state === 'closed') {
          return typeof callback === 'function' ? callback() : undefined;
        }

        this.connection.send({ doc: this.name, open: false });

        // Should this happen immediately or when we get open:false back from the server?
        this.state = 'closed';

        this.emit('closing');
        return this._closeCallback = callback;
      }
    }]);

    return Doc;
  }();

  // Make documents event emitters


  MicroEvent.mixin(Doc);

  exports.Doc = Doc;

  return exports;
})()

export default window.sharejs
