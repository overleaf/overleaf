# An alternate composable implementation for text. This is much closer
# to the implementation used by google wave.
#
# Ops are lists of components which iterate over the whole document.
# Components are either:
#   A number N: Skip N characters in the original document
#   {i:'str'}:  Insert 'str' at the current position in the document
#   {d:'str'}:  Delete 'str', which appears at the current position in the document
#
# Eg: [3, {i:'hi'}, 5, {d:'internet'}]
#
# Snapshots are strings.

p = -> #require('util').debug
i = -> #require('util').inspect

exports = if WEB? then {} else module.exports

exports.name = 'text-composable'

exports.create = -> ''

# -------- Utility methods

checkOp = (op) ->
  throw new Error('Op must be an array of components') unless Array.isArray(op)
  last = null
  for c in op
    if typeof(c) == 'object'
      throw new Error("Invalid op component: #{i c}") unless (c.i? && c.i.length > 0) or (c.d? && c.d.length > 0)
    else
      throw new Error('Op components must be objects or numbers') unless typeof(c) == 'number'
      throw new Error('Skip components must be a positive number') unless c > 0
      throw new Error('Adjacent skip components should be added') if typeof(last) == 'number'

    last = c

# Makes a function for appending components to a given op.
# Exported for the randomOpGenerator.
exports._makeAppend = makeAppend = (op) -> (component) ->
  if component == 0 || component.i == '' || component.d == ''
    return
  else if op.length == 0
    op.push component
  else if typeof(component) == 'number' && typeof(op[op.length - 1]) == 'number'
    op[op.length - 1] += component
  else if component.i? && op[op.length - 1].i?
    op[op.length - 1].i += component.i
  else if component.d? && op[op.length - 1].d?
    op[op.length - 1].d += component.d
  else
    op.push component
  
#  checkOp op

# Makes 2 functions for taking components from the start of an op, and for peeking
# at the next op that could be taken.
makeTake = (op) ->
  # The index of the next component to take
  idx = 0
  # The offset into the component
  offset = 0

  # Take up to length n from the front of op. If n is null, take the next
  # op component. If indivisableField == 'd', delete components won't be separated.
  # If indivisableField == 'i', insert components won't be separated.
  take = (n, indivisableField) ->
    return null if idx == op.length
    #assert.notStrictEqual op.length, i, 'The op is too short to traverse the document'

    if typeof(op[idx]) == 'number'
      if !n? or op[idx] - offset <= n
        c = op[idx] - offset
        ++idx; offset = 0
        c
      else
        offset += n
        n
    else
      # Take from the string
      field = if op[idx].i then 'i' else 'd'
      c = {}
      if !n? or op[idx][field].length - offset <= n or field == indivisableField
        c[field] = op[idx][field][offset..]
        ++idx; offset = 0
      else
        c[field] = op[idx][field][offset...(offset + n)]
        offset += n
      c
  
  peekType = () ->
    op[idx]
  
  [take, peekType]

# Find and return the length of an op component
componentLength = (component) ->
  if typeof(component) == 'number'
    component
  else if component.i?
    component.i.length
  else
    component.d.length

# Normalize an op, removing all empty skips and empty inserts / deletes. Concatenate
# adjacent inserts and deletes.
exports.normalize = (op) ->
  newOp = []
  append = makeAppend newOp
  append component for component in op
  newOp

# Apply the op to the string. Returns the new string.
exports.apply = (str, op) ->
  p "Applying #{i op} to '#{str}'"
  throw new Error('Snapshot should be a string') unless typeof(str) == 'string'
  checkOp op

  pos = 0
  newDoc = []

  for component in op
    if typeof(component) == 'number'
      throw new Error('The op is too long for this document') if component > str.length
      newDoc.push str[...component]
      str = str[component..]
    else if component.i?
      newDoc.push component.i
    else
      throw new Error("The deleted text '#{component.d}' doesn't match the next characters in the document '#{str[...component.d.length]}'") unless component.d == str[...component.d.length]
      str = str[component.d.length..]
  
  throw new Error("The applied op doesn't traverse the entire document") unless '' == str

  newDoc.join ''

# transform op1 by op2. Return transformed version of op1.
# op1 and op2 are unchanged by transform.
exports.transform = (op, otherOp, side) ->
  throw new Error "side (#{side} must be 'left' or 'right'" unless side == 'left' or side == 'right'

  checkOp op
  checkOp otherOp
  newOp = []

  append = makeAppend newOp
  [take, peek] = makeTake op

  for component in otherOp
    if typeof(component) == 'number' # Skip
      length = component
      while length > 0
        chunk = take(length, 'i')
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        append chunk
        length -= componentLength chunk unless typeof(chunk) == 'object' && chunk.i?
    else if component.i? # Insert
      if side == 'left'
        # The left insert should go first.
        o = peek()
        append take() if o?.i

      # Otherwise, skip the inserted text.
      append(component.i.length)
    else # Delete.
      #assert.ok component.d
      length = component.d.length
      while length > 0
        chunk = take(length, 'i')
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        if typeof(chunk) == 'number'
          length -= chunk
        else if chunk.i?
          append(chunk)
        else
          #assert.ok chunk.d
          # The delete is unnecessary now.
          length -= chunk.d.length
  
  # Append extras from op1
  while (component = take())
    throw new Error "Remaining fragments in the op: #{i component}" unless component?.i?
    append component

  newOp


# Compose 2 ops into 1 op.
exports.compose = (op1, op2) ->
  p "COMPOSE #{i op1} + #{i op2}"
  checkOp op1
  checkOp op2

  result = []

  append = makeAppend result
  [take, _] = makeTake op1

  for component in op2
    if typeof(component) == 'number' # Skip
      length = component
      while length > 0
        chunk = take(length, 'd')
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        append chunk
        length -= componentLength chunk unless typeof(chunk) == 'object' && chunk.d?

    else if component.i? # Insert
      append {i:component.i}

    else # Delete
      offset = 0
      while offset < component.d.length
        chunk = take(component.d.length - offset, 'd')
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        # If its delete, append it. If its skip, drop it and decrease length. If its insert, check the strings match, drop it and decrease length.
        if typeof(chunk) == 'number'
          append {d:component.d[offset...(offset + chunk)]}
          offset += chunk
        else if chunk.i?
          throw new Error("The deleted text doesn't match the inserted text") unless component.d[offset...(offset + chunk.i.length)] == chunk.i
          offset += chunk.i.length
          # The ops cancel each other out.
        else
          # Delete
          append chunk
    
  # Append extras from op1
  while (component = take())
    throw new Error "Trailing stuff in op1 #{i component}" unless component?.d?
    append component

  result
  

invertComponent = (c) ->
  if typeof(c) == 'number'
    c
  else if c.i?
    {d:c.i}
  else
    {i:c.d}

# Invert an op
exports.invert = (op) ->
  result = []
  append = makeAppend result

  append(invertComponent component) for component in op
  
  result

if window?
  window.ot ||= {}
  window.ot.types ||= {}
  window.ot.types.text = exports

