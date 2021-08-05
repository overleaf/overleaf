/* eslint-disable
    no-return-assign,
    no-undef,
    no-useless-catch,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This is the implementation of the JSON OT type.
//
// Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

let text
if (typeof WEB !== 'undefined' && WEB !== null) {
  ;({ text } = exports.types)
} else {
  text = require('./text')
}

const json = {}

json.name = 'json'

json.create = () => null

json.invertComponent = function (c) {
  const c_ = { p: c.p }
  if (c.si !== undefined) {
    c_.sd = c.si
  }
  if (c.sd !== undefined) {
    c_.si = c.sd
  }
  if (c.oi !== undefined) {
    c_.od = c.oi
  }
  if (c.od !== undefined) {
    c_.oi = c.od
  }
  if (c.li !== undefined) {
    c_.ld = c.li
  }
  if (c.ld !== undefined) {
    c_.li = c.ld
  }
  if (c.na !== undefined) {
    c_.na = -c.na
  }
  if (c.lm !== undefined) {
    c_.lm = c.p[c.p.length - 1]
    c_.p = c.p.slice(0, c.p.length - 1).concat([c.lm])
  }
  return c_
}

json.invert = op =>
  Array.from(op.slice().reverse()).map(c => json.invertComponent(c))

json.checkValidOp = function (op) {}

const isArray = o => Object.prototype.toString.call(o) === '[object Array]'
json.checkList = function (elem) {
  if (!isArray(elem)) {
    throw new Error('Referenced element not a list')
  }
}

json.checkObj = function (elem) {
  if (elem.constructor !== Object) {
    throw new Error(
      `Referenced element not an object (it was ${JSON.stringify(elem)})`
    )
  }
}

json.apply = function (snapshot, op) {
  json.checkValidOp(op)
  op = clone(op)

  const container = { data: clone(snapshot) }

  try {
    for (let i = 0; i < op.length; i++) {
      const c = op[i]
      let parent = null
      let parentkey = null
      let elem = container
      let key = 'data'

      for (const p of Array.from(c.p)) {
        parent = elem
        parentkey = key
        elem = elem[key]
        key = p

        if (parent == null) {
          throw new Error('Path invalid')
        }
      }

      if (c.na !== undefined) {
        // Number add
        if (typeof elem[key] !== 'number') {
          throw new Error('Referenced element not a number')
        }
        elem[key] += c.na
      } else if (c.si !== undefined) {
        // String insert
        if (typeof elem !== 'string') {
          throw new Error(
            `Referenced element not a string (it was ${JSON.stringify(elem)})`
          )
        }
        parent[parentkey] = elem.slice(0, key) + c.si + elem.slice(key)
      } else if (c.sd !== undefined) {
        // String delete
        if (typeof elem !== 'string') {
          throw new Error('Referenced element not a string')
        }
        if (elem.slice(key, key + c.sd.length) !== c.sd) {
          throw new Error('Deleted string does not match')
        }
        parent[parentkey] = elem.slice(0, key) + elem.slice(key + c.sd.length)
      } else if (c.li !== undefined && c.ld !== undefined) {
        // List replace
        json.checkList(elem)

        // Should check the list element matches c.ld
        elem[key] = c.li
      } else if (c.li !== undefined) {
        // List insert
        json.checkList(elem)

        elem.splice(key, 0, c.li)
      } else if (c.ld !== undefined) {
        // List delete
        json.checkList(elem)

        // Should check the list element matches c.ld here too.
        elem.splice(key, 1)
      } else if (c.lm !== undefined) {
        // List move
        json.checkList(elem)
        if (c.lm !== key) {
          const e = elem[key]
          // Remove it...
          elem.splice(key, 1)
          // And insert it back.
          elem.splice(c.lm, 0, e)
        }
      } else if (c.oi !== undefined) {
        // Object insert / replace
        json.checkObj(elem)

        // Should check that elem[key] == c.od
        elem[key] = c.oi
      } else if (c.od !== undefined) {
        // Object delete
        json.checkObj(elem)

        // Should check that elem[key] == c.od
        delete elem[key]
      } else {
        throw new Error('invalid / missing instruction in op')
      }
    }
  } catch (error) {
    // TODO: Roll back all already applied changes. Write tests before implementing this code.
    throw error
  }

  return container.data
}

// Checks if two paths, p1 and p2 match.
json.pathMatches = function (p1, p2, ignoreLast) {
  if (p1.length !== p2.length) {
    return false
  }

  for (let i = 0; i < p1.length; i++) {
    const p = p1[i]
    if (p !== p2[i] && (!ignoreLast || i !== p1.length - 1)) {
      return false
    }
  }

  return true
}

json.append = function (dest, c) {
  let last
  c = clone(c)
  if (
    dest.length !== 0 &&
    json.pathMatches(c.p, (last = dest[dest.length - 1]).p)
  ) {
    if (last.na !== undefined && c.na !== undefined) {
      return (dest[dest.length - 1] = { p: last.p, na: last.na + c.na })
    } else if (
      last.li !== undefined &&
      c.li === undefined &&
      c.ld === last.li
    ) {
      // insert immediately followed by delete becomes a noop.
      if (last.ld !== undefined) {
        // leave the delete part of the replace
        return delete last.li
      } else {
        return dest.pop()
      }
    } else if (
      last.od !== undefined &&
      last.oi === undefined &&
      c.oi !== undefined &&
      c.od === undefined
    ) {
      return (last.oi = c.oi)
    } else if (c.lm !== undefined && c.p[c.p.length - 1] === c.lm) {
      return null // don't do anything
    } else {
      return dest.push(c)
    }
  } else {
    return dest.push(c)
  }
}

json.compose = function (op1, op2) {
  json.checkValidOp(op1)
  json.checkValidOp(op2)

  const newOp = clone(op1)
  for (const c of Array.from(op2)) {
    json.append(newOp, c)
  }

  return newOp
}

json.normalize = function (op) {
  const newOp = []

  if (!isArray(op)) {
    op = [op]
  }

  for (const c of Array.from(op)) {
    if (c.p == null) {
      c.p = []
    }
    json.append(newOp, c)
  }

  return newOp
}

// hax, copied from test/types/json. Apparently this is still the fastest way to deep clone an object, assuming
// we have browser support for JSON.
// http://jsperf.com/cloning-an-object/12
var clone = o => JSON.parse(JSON.stringify(o))

json.commonPath = function (p1, p2) {
  p1 = p1.slice()
  p2 = p2.slice()
  p1.unshift('data')
  p2.unshift('data')
  p1 = p1.slice(0, p1.length - 1)
  p2 = p2.slice(0, p2.length - 1)
  if (p2.length === 0) {
    return -1
  }
  let i = 0
  while (p1[i] === p2[i] && i < p1.length) {
    i++
    if (i === p2.length) {
      return i - 1
    }
  }
}

// transform c so it applies to a document with otherC applied.
json.transformComponent = function (dest, c, otherC, type) {
  let oc
  c = clone(c)
  if (c.na !== undefined) {
    c.p.push(0)
  }
  if (otherC.na !== undefined) {
    otherC.p.push(0)
  }

  const common = json.commonPath(c.p, otherC.p)
  const common2 = json.commonPath(otherC.p, c.p)

  const cplength = c.p.length
  const otherCplength = otherC.p.length

  if (c.na !== undefined) {
    c.p.pop()
  } // hax
  if (otherC.na !== undefined) {
    otherC.p.pop()
  }

  if (otherC.na) {
    if (
      common2 != null &&
      otherCplength >= cplength &&
      otherC.p[common2] === c.p[common2]
    ) {
      if (c.ld !== undefined) {
        oc = clone(otherC)
        oc.p = oc.p.slice(cplength)
        c.ld = json.apply(clone(c.ld), [oc])
      } else if (c.od !== undefined) {
        oc = clone(otherC)
        oc.p = oc.p.slice(cplength)
        c.od = json.apply(clone(c.od), [oc])
      }
    }
    json.append(dest, c)
    return dest
  }

  if (
    common2 != null &&
    otherCplength > cplength &&
    c.p[common2] === otherC.p[common2]
  ) {
    // transform based on c
    if (c.ld !== undefined) {
      oc = clone(otherC)
      oc.p = oc.p.slice(cplength)
      c.ld = json.apply(clone(c.ld), [oc])
    } else if (c.od !== undefined) {
      oc = clone(otherC)
      oc.p = oc.p.slice(cplength)
      c.od = json.apply(clone(c.od), [oc])
    }
  }

  if (common != null) {
    let from, p, to
    const commonOperand = cplength === otherCplength
    // transform based on otherC
    if (otherC.na !== undefined) {
      // this case is handled above due to icky path hax
    } else if (otherC.si !== undefined || otherC.sd !== undefined) {
      // String op vs string op - pass through to text type
      if (c.si !== undefined || c.sd !== undefined) {
        if (!commonOperand) {
          throw new Error('must be a string?')
        }

        // Convert an op component to a text op component
        const convert = function (component) {
          const newC = { p: component.p[component.p.length - 1] }
          if (component.si) {
            newC.i = component.si
          } else {
            newC.d = component.sd
          }
          return newC
        }

        const tc1 = convert(c)
        const tc2 = convert(otherC)

        const res = []
        text._tc(res, tc1, tc2, type)
        for (const tc of Array.from(res)) {
          const jc = { p: c.p.slice(0, common) }
          jc.p.push(tc.p)
          if (tc.i != null) {
            jc.si = tc.i
          }
          if (tc.d != null) {
            jc.sd = tc.d
          }
          json.append(dest, jc)
        }
        return dest
      }
    } else if (otherC.li !== undefined && otherC.ld !== undefined) {
      if (otherC.p[common] === c.p[common]) {
        // noop
        if (!commonOperand) {
          // we're below the deleted element, so -> noop
          return dest
        } else if (c.ld !== undefined) {
          // we're trying to delete the same element, -> noop
          if (c.li !== undefined && type === 'left') {
            // we're both replacing one element with another. only one can
            // survive!
            c.ld = clone(otherC.li)
          } else {
            return dest
          }
        }
      }
    } else if (otherC.li !== undefined) {
      if (
        c.li !== undefined &&
        c.ld === undefined &&
        commonOperand &&
        c.p[common] === otherC.p[common]
      ) {
        // in li vs. li, left wins.
        if (type === 'right') {
          c.p[common]++
        }
      } else if (otherC.p[common] <= c.p[common]) {
        c.p[common]++
      }

      if (c.lm !== undefined) {
        if (commonOperand) {
          // otherC edits the same list we edit
          if (otherC.p[common] <= c.lm) {
            c.lm++
          }
        }
      }
      // changing c.from is handled above.
    } else if (otherC.ld !== undefined) {
      if (c.lm !== undefined) {
        if (commonOperand) {
          if (otherC.p[common] === c.p[common]) {
            // they deleted the thing we're trying to move
            return dest
          }
          // otherC edits the same list we edit
          p = otherC.p[common]
          from = c.p[common]
          to = c.lm
          if (p < to || (p === to && from < to)) {
            c.lm--
          }
        }
      }

      if (otherC.p[common] < c.p[common]) {
        c.p[common]--
      } else if (otherC.p[common] === c.p[common]) {
        if (otherCplength < cplength) {
          // we're below the deleted element, so -> noop
          return dest
        } else if (c.ld !== undefined) {
          if (c.li !== undefined) {
            // we're replacing, they're deleting. we become an insert.
            delete c.ld
          } else {
            // we're trying to delete the same element, -> noop
            return dest
          }
        }
      }
    } else if (otherC.lm !== undefined) {
      if (c.lm !== undefined && cplength === otherCplength) {
        // lm vs lm, here we go!
        from = c.p[common]
        to = c.lm
        const otherFrom = otherC.p[common]
        const otherTo = otherC.lm
        if (otherFrom !== otherTo) {
          // if otherFrom == otherTo, we don't need to change our op.

          // where did my thing go?
          if (from === otherFrom) {
            // they moved it! tie break.
            if (type === 'left') {
              c.p[common] = otherTo
              if (from === to) {
                // ugh
                c.lm = otherTo
              }
            } else {
              return dest
            }
          } else {
            // they moved around it
            if (from > otherFrom) {
              c.p[common]--
            }
            if (from > otherTo) {
              c.p[common]++
            } else if (from === otherTo) {
              if (otherFrom > otherTo) {
                c.p[common]++
                if (from === to) {
                  // ugh, again
                  c.lm++
                }
              }
            }

            // step 2: where am i going to put it?
            if (to > otherFrom) {
              c.lm--
            } else if (to === otherFrom) {
              if (to > from) {
                c.lm--
              }
            }
            if (to > otherTo) {
              c.lm++
            } else if (to === otherTo) {
              // if we're both moving in the same direction, tie break
              if (
                (otherTo > otherFrom && to > from) ||
                (otherTo < otherFrom && to < from)
              ) {
                if (type === 'right') {
                  c.lm++
                }
              } else {
                if (to > from) {
                  c.lm++
                } else if (to === otherFrom) {
                  c.lm--
                }
              }
            }
          }
        }
      } else if (c.li !== undefined && c.ld === undefined && commonOperand) {
        // li
        from = otherC.p[common]
        to = otherC.lm
        p = c.p[common]
        if (p > from) {
          c.p[common]--
        }
        if (p > to) {
          c.p[common]++
        }
      } else {
        // ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        // the lm
        //
        // i.e. things care about where their item is after the move.
        from = otherC.p[common]
        to = otherC.lm
        p = c.p[common]
        if (p === from) {
          c.p[common] = to
        } else {
          if (p > from) {
            c.p[common]--
          }
          if (p > to) {
            c.p[common]++
          } else if (p === to) {
            if (from > to) {
              c.p[common]++
            }
          }
        }
      }
    } else if (otherC.oi !== undefined && otherC.od !== undefined) {
      if (c.p[common] === otherC.p[common]) {
        if (c.oi !== undefined && commonOperand) {
          // we inserted where someone else replaced
          if (type === 'right') {
            // left wins
            return dest
          } else {
            // we win, make our op replace what they inserted
            c.od = otherC.oi
          }
        } else {
          // -> noop if the other component is deleting the same object (or any
          // parent)
          return dest
        }
      }
    } else if (otherC.oi !== undefined) {
      if (c.oi !== undefined && c.p[common] === otherC.p[common]) {
        // left wins if we try to insert at the same place
        if (type === 'left') {
          json.append(dest, { p: c.p, od: otherC.oi })
        } else {
          return dest
        }
      }
    } else if (otherC.od !== undefined) {
      if (c.p[common] === otherC.p[common]) {
        if (!commonOperand) {
          return dest
        }
        if (c.oi !== undefined) {
          delete c.od
        } else {
          return dest
        }
      }
    }
  }

  json.append(dest, c)
  return dest
}

if (typeof WEB !== 'undefined' && WEB !== null) {
  if (!exports.types) {
    exports.types = {}
  }

  // This is kind of awful - come up with a better way to hook this helper code up.
  exports._bt(json, json.transformComponent, json.checkValidOp, json.append)

  // [] is used to prevent closure from renaming types.text
  exports.types.json = json
} else {
  module.exports = json

  require('./helpers').bootstrapTransform(
    json,
    json.transformComponent,
    json.checkValidOp,
    json.append
  )
}
