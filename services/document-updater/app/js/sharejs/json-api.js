/* eslint-disable
    camelcase,
    no-undef,
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
// API for JSON OT

let json
if (typeof WEB === 'undefined') {
  json = require('./json')
}

if (typeof WEB !== 'undefined' && WEB !== null) {
  const { extendDoc } = exports
  exports.extendDoc = function (name, fn) {
    SubDoc.prototype[name] = fn
    return extendDoc(name, fn)
  }
}

const depath = function (path) {
  if (path.length === 1 && path[0].constructor === Array) {
    return path[0]
  } else {
    return path
  }
}

class SubDoc {
  constructor(doc, path) {
    this.doc = doc
    this.path = path
  }

  at(...path) {
    return this.doc.at(this.path.concat(depath(path)))
  }

  get() {
    return this.doc.getAt(this.path)
  }

  // for objects and lists
  set(value, cb) {
    return this.doc.setAt(this.path, value, cb)
  }

  // for strings and lists.
  insert(pos, value, cb) {
    return this.doc.insertAt(this.path, pos, value, cb)
  }

  // for strings
  del(pos, length, cb) {
    return this.doc.deleteTextAt(this.path, length, pos, cb)
  }

  // for objects and lists
  remove(cb) {
    return this.doc.removeAt(this.path, cb)
  }

  push(value, cb) {
    return this.insert(this.get().length, value, cb)
  }

  move(from, to, cb) {
    return this.doc.moveAt(this.path, from, to, cb)
  }

  add(amount, cb) {
    return this.doc.addAt(this.path, amount, cb)
  }

  on(event, cb) {
    return this.doc.addListener(this.path, event, cb)
  }

  removeListener(l) {
    return this.doc.removeListener(l)
  }

  // text API compatibility
  getLength() {
    return this.get().length
  }

  getText() {
    return this.get()
  }
}

const traverse = function (snapshot, path) {
  const container = { data: snapshot }
  let key = 'data'
  let elem = container
  for (const p of Array.from(path)) {
    elem = elem[key]
    key = p
    if (typeof elem === 'undefined') {
      throw new Error('bad path')
    }
  }
  return { elem, key }
}

const pathEquals = function (p1, p2) {
  if (p1.length !== p2.length) {
    return false
  }
  for (let i = 0; i < p1.length; i++) {
    const e = p1[i]
    if (e !== p2[i]) {
      return false
    }
  }
  return true
}

json.api = {
  provides: { json: true },

  at(...path) {
    return new SubDoc(this, depath(path))
  },

  get() {
    return this.snapshot
  },
  set(value, cb) {
    return this.setAt([], value, cb)
  },

  getAt(path) {
    const { elem, key } = traverse(this.snapshot, path)
    return elem[key]
  },

  setAt(path, value, cb) {
    const { elem, key } = traverse(this.snapshot, path)
    const op = { p: path }
    if (elem.constructor === Array) {
      op.li = value
      if (typeof elem[key] !== 'undefined') {
        op.ld = elem[key]
      }
    } else if (typeof elem === 'object') {
      op.oi = value
      if (typeof elem[key] !== 'undefined') {
        op.od = elem[key]
      }
    } else {
      throw new Error('bad path')
    }
    return this.submitOp([op], cb)
  },

  removeAt(path, cb) {
    const { elem, key } = traverse(this.snapshot, path)
    if (typeof elem[key] === 'undefined') {
      throw new Error('no element at that path')
    }
    const op = { p: path }
    if (elem.constructor === Array) {
      op.ld = elem[key]
    } else if (typeof elem === 'object') {
      op.od = elem[key]
    } else {
      throw new Error('bad path')
    }
    return this.submitOp([op], cb)
  },

  insertAt(path, pos, value, cb) {
    const { elem, key } = traverse(this.snapshot, path)
    const op = { p: path.concat(pos) }
    if (elem[key].constructor === Array) {
      op.li = value
    } else if (typeof elem[key] === 'string') {
      op.si = value
    }
    return this.submitOp([op], cb)
  },

  moveAt(path, from, to, cb) {
    const op = [{ p: path.concat(from), lm: to }]
    return this.submitOp(op, cb)
  },

  addAt(path, amount, cb) {
    const op = [{ p: path, na: amount }]
    return this.submitOp(op, cb)
  },

  deleteTextAt(path, length, pos, cb) {
    const { elem, key } = traverse(this.snapshot, path)
    const op = [{ p: path.concat(pos), sd: elem[key].slice(pos, pos + length) }]
    return this.submitOp(op, cb)
  },

  addListener(path, event, cb) {
    const l = { path, event, cb }
    this._listeners.push(l)
    return l
  },
  removeListener(l) {
    const i = this._listeners.indexOf(l)
    if (i < 0) {
      return false
    }
    this._listeners.splice(i, 1)
    return true
  },
  _register() {
    this._listeners = []
    this.on('change', function (op) {
      return (() => {
        const result = []
        for (const c of Array.from(op)) {
          var i
          if (c.na !== undefined || c.si !== undefined || c.sd !== undefined) {
            // no change to structure
            continue
          }
          var to_remove = []
          for (i = 0; i < this._listeners.length; i++) {
            // Transform a dummy op by the incoming op to work out what
            // should happen to the listener.
            const l = this._listeners[i]
            const dummy = { p: l.path, na: 0 }
            const xformed = this.type.transformComponent([], dummy, c, 'left')
            if (xformed.length === 0) {
              // The op was transformed to noop, so we should delete the listener.
              to_remove.push(i)
            } else if (xformed.length === 1) {
              // The op remained, so grab its new path into the listener.
              l.path = xformed[0].p
            } else {
              throw new Error(
                "Bad assumption in json-api: xforming an 'si' op will always result in 0 or 1 components."
              )
            }
          }
          to_remove.sort((a, b) => b - a)
          result.push(
            (() => {
              const result1 = []
              for (i of Array.from(to_remove)) {
                result1.push(this._listeners.splice(i, 1))
              }
              return result1
            })()
          )
        }
        return result
      })()
    })
    return this.on('remoteop', function (op) {
      return (() => {
        const result = []
        for (var c of Array.from(op)) {
          var match_path =
            c.na === undefined ? c.p.slice(0, c.p.length - 1) : c.p
          result.push(
            (() => {
              const result1 = []
              for (const { path, event, cb } of Array.from(this._listeners)) {
                var common
                if (pathEquals(path, match_path)) {
                  switch (event) {
                    case 'insert':
                      if (c.li !== undefined && c.ld === undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.li))
                      } else if (c.oi !== undefined && c.od === undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.oi))
                      } else if (c.si !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.si))
                      } else {
                        result1.push(undefined)
                      }
                      break
                    case 'delete':
                      if (c.li === undefined && c.ld !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.ld))
                      } else if (c.oi === undefined && c.od !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.od))
                      } else if (c.sd !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.sd))
                      } else {
                        result1.push(undefined)
                      }
                      break
                    case 'replace':
                      if (c.li !== undefined && c.ld !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.ld, c.li))
                      } else if (c.oi !== undefined && c.od !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.od, c.oi))
                      } else {
                        result1.push(undefined)
                      }
                      break
                    case 'move':
                      if (c.lm !== undefined) {
                        result1.push(cb(c.p[c.p.length - 1], c.lm))
                      } else {
                        result1.push(undefined)
                      }
                      break
                    case 'add':
                      if (c.na !== undefined) {
                        result1.push(cb(c.na))
                      } else {
                        result1.push(undefined)
                      }
                      break
                    default:
                      result1.push(undefined)
                  }
                } else if (
                  (common = this.type.commonPath(match_path, path)) != null
                ) {
                  if (event === 'child op') {
                    if (
                      match_path.length === path.length &&
                      path.length === common
                    ) {
                      throw new Error(
                        "paths match length and have commonality, but aren't equal?"
                      )
                    }
                    const child_path = c.p.slice(common + 1)
                    result1.push(cb(child_path, c))
                  } else {
                    result1.push(undefined)
                  }
                } else {
                  result1.push(undefined)
                }
              }
              return result1
            })()
          )
        }
        return result
      })()
    })
  },
}
