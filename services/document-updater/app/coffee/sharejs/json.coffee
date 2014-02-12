# This is the implementation of the JSON OT type.
#
# Spec is here: https://github.com/josephg/ShareJS/wiki/JSON-Operations

if WEB?
  text = exports.types.text
else
  text = require './text'

json = {}

json.name = 'json'

json.create = -> null

json.invertComponent = (c) ->
  c_ = {p: c.p}
  c_.sd = c.si if c.si != undefined
  c_.si = c.sd if c.sd != undefined
  c_.od = c.oi if c.oi != undefined
  c_.oi = c.od if c.od != undefined
  c_.ld = c.li if c.li != undefined
  c_.li = c.ld if c.ld != undefined
  c_.na = -c.na if c.na != undefined
  if c.lm != undefined
    c_.lm = c.p[c.p.length-1]
    c_.p = c.p[0...c.p.length - 1].concat([c.lm])
  c_

json.invert = (op) -> json.invertComponent c for c in op.slice().reverse()

json.checkValidOp = (op) ->

isArray = (o) -> Object.prototype.toString.call(o) == '[object Array]'
json.checkList = (elem) ->
  throw new Error 'Referenced element not a list' unless isArray(elem)

json.checkObj = (elem) ->
  throw new Error "Referenced element not an object (it was #{JSON.stringify elem})" unless elem.constructor is Object

json.apply = (snapshot, op) ->
  json.checkValidOp op
  op = clone op

  container = {data: clone snapshot}

  try
    for c, i in op
      parent = null
      parentkey = null
      elem = container
      key = 'data'

      for p in c.p
        parent = elem
        parentkey = key
        elem = elem[key]
        key = p

        throw new Error 'Path invalid' unless parent?

      if c.na != undefined
        # Number add
        throw new Error 'Referenced element not a number' unless typeof elem[key] is 'number'
        elem[key] += c.na

      else if c.si != undefined
        # String insert
        throw new Error "Referenced element not a string (it was #{JSON.stringify elem})" unless typeof elem is 'string'
        parent[parentkey] = elem[...key] + c.si + elem[key..]
      else if c.sd != undefined
        # String delete
        throw new Error 'Referenced element not a string' unless typeof elem is 'string'
        throw new Error 'Deleted string does not match' unless elem[key...key + c.sd.length] == c.sd
        parent[parentkey] = elem[...key] + elem[key + c.sd.length..]

      else if c.li != undefined && c.ld != undefined
        # List replace
        json.checkList elem

        # Should check the list element matches c.ld
        elem[key] = c.li
      else if c.li != undefined
        # List insert
        json.checkList elem

        elem.splice key, 0, c.li
      else if c.ld != undefined
        # List delete
        json.checkList elem

        # Should check the list element matches c.ld here too.
        elem.splice key, 1
      else if c.lm != undefined
        # List move
        json.checkList elem
        if c.lm != key
          e = elem[key]
          # Remove it...
          elem.splice key, 1
          # And insert it back.
          elem.splice c.lm, 0, e

      else if c.oi != undefined
        # Object insert / replace
        json.checkObj elem
        
        # Should check that elem[key] == c.od
        elem[key] = c.oi
      else if c.od != undefined
        # Object delete
        json.checkObj elem

        # Should check that elem[key] == c.od
        delete elem[key]
      else
        throw new Error 'invalid / missing instruction in op'
  catch error
    # TODO: Roll back all already applied changes. Write tests before implementing this code.
    throw error

  container.data

# Checks if two paths, p1 and p2 match.
json.pathMatches = (p1, p2, ignoreLast) ->
  return false unless p1.length == p2.length

  for p, i in p1
    return false if p != p2[i] and (!ignoreLast or i != p1.length - 1)
      
  true

json.append = (dest, c) ->
  c = clone c
  if dest.length != 0 and json.pathMatches c.p, (last = dest[dest.length - 1]).p
    if last.na != undefined and c.na != undefined
      dest[dest.length - 1] = { p: last.p, na: last.na + c.na }
    else if last.li != undefined and c.li == undefined and c.ld == last.li
      # insert immediately followed by delete becomes a noop.
      if last.ld != undefined
        # leave the delete part of the replace
        delete last.li
      else
        dest.pop()
    else if last.od != undefined and last.oi == undefined and
        c.oi != undefined and c.od == undefined
      last.oi = c.oi
    else if c.lm != undefined and c.p[c.p.length-1] == c.lm
      null # don't do anything
    else
      dest.push c
  else
    dest.push c

json.compose = (op1, op2) ->
  json.checkValidOp op1
  json.checkValidOp op2

  newOp = clone op1
  json.append newOp, c for c in op2

  newOp

json.normalize = (op) ->
  newOp = []
  
  op = [op] unless isArray op

  for c in op
    c.p ?= []
    json.append newOp, c
  
  newOp

# hax, copied from test/types/json. Apparently this is still the fastest way to deep clone an object, assuming
# we have browser support for JSON.
# http://jsperf.com/cloning-an-object/12
clone = (o) -> JSON.parse(JSON.stringify o)

json.commonPath = (p1, p2) ->
  p1 = p1.slice()
  p2 = p2.slice()
  p1.unshift('data')
  p2.unshift('data')
  p1 = p1[...p1.length-1]
  p2 = p2[...p2.length-1]
  return -1 if p2.length == 0
  i = 0
  while p1[i] == p2[i] && i < p1.length
    i++
    if i == p2.length
      return i-1
  return

# transform c so it applies to a document with otherC applied.
json.transformComponent = (dest, c, otherC, type) ->
  c = clone c
  c.p.push(0) if c.na != undefined
  otherC.p.push(0) if otherC.na != undefined

  common = json.commonPath c.p, otherC.p
  common2 = json.commonPath otherC.p, c.p

  cplength = c.p.length
  otherCplength = otherC.p.length

  c.p.pop() if c.na != undefined # hax
  otherC.p.pop() if otherC.na != undefined

  if otherC.na
    if common2? && otherCplength >= cplength && otherC.p[common2] == c.p[common2]
      if c.ld != undefined
        oc = clone otherC
        oc.p = oc.p[cplength..]
        c.ld = json.apply clone(c.ld), [oc]
      else if c.od != undefined
        oc = clone otherC
        oc.p = oc.p[cplength..]
        c.od = json.apply clone(c.od), [oc]
    json.append dest, c
    return dest

  if common2? && otherCplength > cplength && c.p[common2] == otherC.p[common2]
    # transform based on c
    if c.ld != undefined
      oc = clone otherC
      oc.p = oc.p[cplength..]
      c.ld = json.apply clone(c.ld), [oc]
    else if c.od != undefined
      oc = clone otherC
      oc.p = oc.p[cplength..]
      c.od = json.apply clone(c.od), [oc]


  if common?
    commonOperand = cplength == otherCplength
    # transform based on otherC
    if otherC.na != undefined
      # this case is handled above due to icky path hax
    else if otherC.si != undefined || otherC.sd != undefined
      # String op vs string op - pass through to text type
      if c.si != undefined || c.sd != undefined
        throw new Error("must be a string?") unless commonOperand

        # Convert an op component to a text op component
        convert = (component) ->
          newC = p:component.p[component.p.length - 1]
          if component.si
            newC.i = component.si
          else
            newC.d = component.sd
          newC

        tc1 = convert c
        tc2 = convert otherC
          
        res = []
        text._tc res, tc1, tc2, type
        for tc in res
          jc = { p: c.p[...common] }
          jc.p.push(tc.p)
          jc.si = tc.i if tc.i?
          jc.sd = tc.d if tc.d?
          json.append dest, jc
        return dest
    else if otherC.li != undefined && otherC.ld != undefined
      if otherC.p[common] == c.p[common]
        # noop
        if !commonOperand
          # we're below the deleted element, so -> noop
          return dest
        else if c.ld != undefined
          # we're trying to delete the same element, -> noop
          if c.li != undefined and type == 'left'
            # we're both replacing one element with another. only one can
            # survive!
            c.ld = clone otherC.li
          else
            return dest
    else if otherC.li != undefined
      if c.li != undefined and c.ld == undefined and commonOperand and c.p[common] == otherC.p[common]
        # in li vs. li, left wins.
        if type == 'right'
          c.p[common]++
      else if otherC.p[common] <= c.p[common]
        c.p[common]++

      if c.lm != undefined
        if commonOperand
          # otherC edits the same list we edit
          if otherC.p[common] <= c.lm
            c.lm++
          # changing c.from is handled above.
    else if otherC.ld != undefined
      if c.lm != undefined
        if commonOperand
          if otherC.p[common] == c.p[common]
            # they deleted the thing we're trying to move
            return dest
          # otherC edits the same list we edit
          p = otherC.p[common]
          from = c.p[common]
          to = c.lm
          if p < to || (p == to && from < to)
            c.lm--

      if otherC.p[common] < c.p[common]
        c.p[common]--
      else if otherC.p[common] == c.p[common]
        if otherCplength < cplength
          # we're below the deleted element, so -> noop
          return dest
        else if c.ld != undefined
          if c.li != undefined
            # we're replacing, they're deleting. we become an insert.
            delete c.ld
          else
            # we're trying to delete the same element, -> noop
            return dest
    else if otherC.lm != undefined
      if c.lm != undefined and cplength == otherCplength
        # lm vs lm, here we go!
        from = c.p[common]
        to = c.lm
        otherFrom = otherC.p[common]
        otherTo = otherC.lm
        if otherFrom != otherTo
          # if otherFrom == otherTo, we don't need to change our op.

          # where did my thing go?
          if from == otherFrom
            # they moved it! tie break.
            if type == 'left'
              c.p[common] = otherTo
              if from == to # ugh
                c.lm = otherTo
            else
              return dest
          else
            # they moved around it
            if from > otherFrom
              c.p[common]--
            if from > otherTo
              c.p[common]++
            else if from == otherTo
              if otherFrom > otherTo
                c.p[common]++
                if from == to # ugh, again
                  c.lm++

            # step 2: where am i going to put it?
            if to > otherFrom
              c.lm--
            else if to == otherFrom
              if to > from
                c.lm--
            if to > otherTo
              c.lm++
            else if to == otherTo
              # if we're both moving in the same direction, tie break
              if (otherTo > otherFrom and to > from) or
                 (otherTo < otherFrom and to < from)
                if type == 'right'
                  c.lm++
              else
                if to > from
                  c.lm++
                else if to == otherFrom
                  c.lm--
      else if c.li != undefined and c.ld == undefined and commonOperand
        # li
        from = otherC.p[common]
        to = otherC.lm
        p = c.p[common]
        if p > from
          c.p[common]--
        if p > to
          c.p[common]++
      else
        # ld, ld+li, si, sd, na, oi, od, oi+od, any li on an element beneath
        # the lm
        #
        # i.e. things care about where their item is after the move.
        from = otherC.p[common]
        to = otherC.lm
        p = c.p[common]
        if p == from
          c.p[common] = to
        else
          if p > from
            c.p[common]--
          if p > to
            c.p[common]++
          else if p == to
            if from > to
              c.p[common]++
    else if otherC.oi != undefined && otherC.od != undefined
      if c.p[common] == otherC.p[common]
        if c.oi != undefined and commonOperand
          # we inserted where someone else replaced
          if type == 'right'
            # left wins
            return dest
          else
            # we win, make our op replace what they inserted
            c.od = otherC.oi
        else
          # -> noop if the other component is deleting the same object (or any
          # parent)
          return dest
    else if otherC.oi != undefined
      if c.oi != undefined and c.p[common] == otherC.p[common]
        # left wins if we try to insert at the same place
        if type == 'left'
          json.append dest, {p:c.p, od:otherC.oi}
        else
          return dest
    else if otherC.od != undefined
      if c.p[common] == otherC.p[common]
        return dest if !commonOperand
        if c.oi != undefined
          delete c.od
        else
          return dest
  
  json.append dest, c
  return dest

if WEB?
  exports.types ||= {}

  # This is kind of awful - come up with a better way to hook this helper code up.
  exports._bt(json, json.transformComponent, json.checkValidOp, json.append)

  # [] is used to prevent closure from renaming types.text
  exports.types.json = json
else
  module.exports = json

  require('./helpers').bootstrapTransform(json, json.transformComponent, json.checkValidOp, json.append)

