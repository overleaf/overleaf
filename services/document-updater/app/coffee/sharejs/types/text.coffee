# A simple text implementation
#
# Operations are lists of components.
# Each component either inserts or deletes at a specified position in the document.
#
# Components are either:
#  {i:'str', p:100}: Insert 'str' at position 100 in the document
#  {d:'str', p:100}: Delete 'str' at position 100 in the document
#
# Components in an operation are executed sequentially, so the position of components
# assumes previous components have already executed.
#
# Eg: This op:
#   [{i:'abc', p:0}]
# is equivalent to this op:
#   [{i:'a', p:0}, {i:'b', p:1}, {i:'c', p:2}]

# NOTE: The global scope here is shared with other sharejs files when built with closure.
# Be careful what ends up in your namespace.

text = {}

text.name = 'text'

text.create = -> ''

strInject = (s1, pos, s2) -> s1[...pos] + s2 + s1[pos..]

checkValidComponent = (c) ->
  throw new Error 'component missing position field' if typeof c.p != 'number'

  i_type = typeof c.i
  d_type = typeof c.d
  c_type = typeof c.c
  throw new Error 'component needs an i, d or c field' unless (i_type == 'string') ^ (d_type == 'string') ^ (c_type == 'string')

  throw new Error 'position cannot be negative' unless c.p >= 0

checkValidOp = (op) ->
  checkValidComponent(c) for c in op
  true

text.apply = (snapshot, op) ->
  checkValidOp op
  for component in op
    if component.i?
      snapshot = strInject snapshot, component.p, component.i
    else if component.d?
      deleted = snapshot[component.p...(component.p + component.d.length)]
      throw new Error "Delete component '#{component.d}' does not match deleted text '#{deleted}'" unless component.d == deleted
      snapshot = snapshot[...component.p] + snapshot[(component.p + component.d.length)..]
    else if component.c?
      comment = snapshot[component.p...(component.p + component.c.length)]
      throw new Error "Comment component '#{component.c}' does not match commented text '#{comment}'" unless component.c == comment
    else
      throw new Error "Unknown op type"
  snapshot


# Exported for use by the random op generator.
#
# For simplicity, this version of append does not compress adjacent inserts and deletes of
# the same text. It would be nice to change that at some stage.
text._append = append = (newOp, c) ->
  return if c.i == '' or c.d == ''
  if newOp.length == 0
    newOp.push c
  else
    last = newOp[newOp.length - 1]

    # Compose the insert into the previous insert if possible
    if last.i? && c.i? and last.p <= c.p <= (last.p + last.i.length)
      newOp[newOp.length - 1] = {i:strInject(last.i, c.p - last.p, c.i), p:last.p}
    else if last.d? && c.d? and c.p <= last.p <= (c.p + c.d.length)
      newOp[newOp.length - 1] = {d:strInject(c.d, last.p - c.p, last.d), p:c.p}
    else
      newOp.push c

text.compose = (op1, op2) ->
  checkValidOp op1
  checkValidOp op2

  newOp = op1.slice()
  append newOp, c for c in op2

  newOp

# Attempt to compress the op components together 'as much as possible'.
# This implementation preserves order and preserves create/delete pairs.
text.compress = (op) -> text.compose [], op

text.normalize = (op) ->
  newOp = []
  
  # Normalize should allow ops which are a single (unwrapped) component:
  # {i:'asdf', p:23}.
  # There's no good way to test if something is an array:
  # http://perfectionkills.com/instanceof-considered-harmful-or-how-to-write-a-robust-isarray/
  # so this is probably the least bad solution.
  op = [op] if op.i? or op.p?

  for c in op
    c.p ?= 0
    append newOp, c
  
  newOp

# This helper method transforms a position by an op component.
#
# If c is an insert, insertAfter specifies whether the transform
# is pushed after the insert (true) or before it (false).
#
# insertAfter is optional for deletes.
transformPosition = (pos, c, insertAfter) ->
  if c.i?
    if c.p < pos || (c.p == pos && insertAfter)
      pos + c.i.length
    else
      pos
  else if c.d?
    # I think this could also be written as: Math.min(c.p, Math.min(c.p - otherC.p, otherC.d.length))
    # but I think its harder to read that way, and it compiles using ternary operators anyway
    # so its no slower written like this.
    if pos <= c.p
      pos
    else if pos <= c.p + c.d.length
      c.p
    else
      pos - c.d.length
  else if c.c?
    pos
  else
    throw new Error("unknown op type")

# Helper method to transform a cursor position as a result of an op.
#
# Like transformPosition above, if c is an insert, insertAfter specifies whether the cursor position
# is pushed after an insert (true) or before it (false).
text.transformCursor = (position, op, side) ->
  insertAfter = side == 'right'
  position = transformPosition position, c, insertAfter for c in op
  position

# Transform an op component by another op component. Asymmetric.
# The result will be appended to destination.
#
# exported for use in JSON type
text._tc = transformComponent = (dest, c, otherC, side) ->
  checkValidOp [c]
  checkValidOp [otherC]

  if c.i?
    append dest, {i:c.i, p:transformPosition(c.p, otherC, side == 'right')}

  else if c.d? # Delete
    if otherC.i? # delete vs insert
      s = c.d
      if c.p < otherC.p
        append dest, {d:s[...otherC.p - c.p], p:c.p}
        s = s[(otherC.p - c.p)..]
      if s != ''
        append dest, {d:s, p:c.p + otherC.i.length}

    else if otherC.d? # Delete vs delete
      if c.p >= otherC.p + otherC.d.length
        append dest, {d:c.d, p:c.p - otherC.d.length}
      else if c.p + c.d.length <= otherC.p
        append dest, c
      else
        # They overlap somewhere.
        newC = {d:'', p:c.p}
        if c.p < otherC.p
          newC.d = c.d[...(otherC.p - c.p)]
        if c.p + c.d.length > otherC.p + otherC.d.length
          newC.d += c.d[(otherC.p + otherC.d.length - c.p)..]

        # This is entirely optional - just for a check that the deleted
        # text in the two ops matches
        intersectStart = Math.max c.p, otherC.p
        intersectEnd = Math.min c.p + c.d.length, otherC.p + otherC.d.length
        cIntersect = c.d[intersectStart - c.p...intersectEnd - c.p]
        otherIntersect = otherC.d[intersectStart - otherC.p...intersectEnd - otherC.p]
        throw new Error 'Delete ops delete different text in the same region of the document' unless cIntersect == otherIntersect

        if newC.d != ''
          # This could be rewritten similarly to insert v delete, above.
          newC.p = transformPosition newC.p, otherC
          append dest, newC
    
    else if otherC.c?
      append dest, c
    
    else
      throw new Error("unknown op type")

  else if c.c? # Comment
    if otherC.i?
      if c.p < otherC.p < c.p + c.c.length
        offset = otherC.p - c.p
        new_c = (c.c[0..(offset-1)] + otherC.i + c.c[offset...])
        append dest, {c:new_c, p:c.p, t: c.t}
      else
        append dest, {c:c.c, p:transformPosition(c.p, otherC, true), t: c.t}
    
    else if otherC.d?
      if c.p >= otherC.p + otherC.d.length
        append dest, {c:c.c, p:c.p - otherC.d.length, t: c.t}
      else if c.p + c.c.length <= otherC.p
        append dest, c
      else # Delete overlaps comment
        # They overlap somewhere.
        newC = {c:'', p:c.p, t: c.t}
        if c.p < otherC.p
          newC.c = c.c[...(otherC.p - c.p)]
        if c.p + c.c.length > otherC.p + otherC.d.length
          newC.c += c.c[(otherC.p + otherC.d.length - c.p)..]

        # This is entirely optional - just for a check that the deleted
        # text in the two ops matches
        intersectStart = Math.max c.p, otherC.p
        intersectEnd = Math.min c.p + c.c.length, otherC.p + otherC.d.length
        cIntersect = c.c[intersectStart - c.p...intersectEnd - c.p]
        otherIntersect = otherC.d[intersectStart - otherC.p...intersectEnd - otherC.p]
        throw new Error 'Delete ops delete different text in the same region of the document' unless cIntersect == otherIntersect

        newC.p = transformPosition newC.p, otherC
        append dest, newC
    
    else if otherC.c?
      append dest, c
    
    else
      throw new Error("unknown op type")
  
  dest

invertComponent = (c) ->
  if c.i?
    {d:c.i, p:c.p}
  else
    {i:c.d, p:c.p}

# No need to use append for invert, because the components won't be able to
# cancel with one another.
text.invert = (op) -> (invertComponent c for c in op.slice().reverse())


if WEB?
  exports.types ||= {}

  # This is kind of awful - come up with a better way to hook this helper code up.
  bootstrapTransform(text, transformComponent, checkValidOp, append)

  # [] is used to prevent closure from renaming types.text
  exports.types.text = text
else
  module.exports = text

  # The text type really shouldn't need this - it should be possible to define
  # an efficient transform function by making a sort of transform map and passing each
  # op component through it.
  require('./helpers').bootstrapTransform(text, transformComponent, checkValidOp, append)

