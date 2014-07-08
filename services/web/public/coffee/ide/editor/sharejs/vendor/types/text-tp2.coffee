# A TP2 implementation of text, following this spec:
# http://code.google.com/p/lightwave/source/browse/trunk/experimental/ot/README
#
# A document is made up of a string and a set of tombstones inserted throughout
# the string. For example, 'some ', (2 tombstones), 'string'.
#
# This is encoded in a document as: {s:'some string', t:[5, -2, 6]}
#
# Ops are lists of components which iterate over the whole document.
# Components are either:
#   N:         Skip N characters in the original document
#   {i:'str'}: Insert 'str' at the current position in the document
#   {i:N}:     Insert N tombstones at the current position in the document
#   {d:N}:     Delete (tombstone) N characters at the current position in the document
#
# Eg: [3, {i:'hi'}, 5, {d:8}]
#
# Snapshots are lists with characters and tombstones. Characters are stored in strings
# and adjacent tombstones are flattened into numbers.
#
# Eg, the document: 'Hello .....world' ('.' denotes tombstoned (deleted) characters)
# would be represented by a document snapshot of ['Hello ', 5, 'world']

type =
  name: 'text-tp2'
  tp2: true
  create: -> {charLength:0, totalLength:0, positionCache:[], data:[]}
  serialize: (doc) ->
    throw new Error 'invalid doc snapshot' unless doc.data
    doc.data
  deserialize: (data) ->
    doc = type.create()
    doc.data = data
    
    for component in data
      if typeof component is 'string'
        doc.charLength += component.length
        doc.totalLength += component.length
      else
        doc.totalLength += component
    
    doc


checkOp = (op) ->
  throw new Error('Op must be an array of components') unless Array.isArray(op)
  last = null
  for c in op
    if typeof(c) == 'object'
      if c.i != undefined
        throw new Error('Inserts must insert a string or a +ive number') unless (typeof(c.i) == 'string' and c.i.length > 0) or (typeof(c.i) == 'number' and c.i > 0)
      else if c.d != undefined
        throw new Error('Deletes must be a +ive number') unless typeof(c.d) == 'number' and c.d > 0
      else
        throw new Error('Operation component must define .i or .d')
    else
      throw new Error('Op components must be objects or numbers') unless typeof(c) == 'number'
      throw new Error('Skip components must be a positive number') unless c > 0
      throw new Error('Adjacent skip components should be combined') if typeof(last) == 'number'

    last = c

# Take the next part from the specified position in a document snapshot.
# position = {index, offset}. It will be updated.
type._takeDoc = takeDoc = (doc, position, maxlength, tombsIndivisible) ->
  throw new Error 'Operation goes past the end of the document' if position.index >= doc.data.length

  part = doc.data[position.index]
  # peel off data[0]
  result = if typeof(part) == 'string'
    if maxlength != undefined
      part[position.offset...(position.offset + maxlength)]
    else
      part[position.offset...]
  else
    if maxlength == undefined or tombsIndivisible
      part - position.offset
    else
      Math.min(maxlength, part - position.offset)
  
  resultLen = result.length || result

  if (part.length || part) - position.offset > resultLen
    position.offset += resultLen
  else
    position.index++
    position.offset = 0
  
  result

# Append a part to the end of a document
type._appendDoc = appendDoc = (doc, p) ->
  return if p == 0 or p == ''

  if typeof p is 'string'
    doc.charLength += p.length
    doc.totalLength += p.length
  else
    doc.totalLength += p

  data = doc.data
  if data.length == 0
    data.push p
  else if typeof(data[data.length - 1]) == typeof(p)
    data[data.length - 1] += p
  else
    data.push p
  return

# Apply the op to the document. The document is not modified in the process.
type.apply = (doc, op) ->
  unless doc.totalLength != undefined and doc.charLength != undefined and doc.data.length != undefined
    throw new Error('Snapshot is invalid')

  checkOp op

  newDoc = type.create()
  position = {index:0, offset:0}

  for component in op
    if typeof(component) is 'number'
      remainder = component
      while remainder > 0
        part = takeDoc doc, position, remainder
        
        appendDoc newDoc, part
        remainder -= part.length || part

    else if component.i != undefined
      appendDoc newDoc, component.i
    else if component.d != undefined
      remainder = component.d
      while remainder > 0
        part = takeDoc doc, position, remainder
        remainder -= part.length || part
      appendDoc newDoc, component.d
  
  newDoc

# Append an op component to the end of the specified op.
# Exported for the randomOpGenerator.
type._append = append = (op, component) ->
  if component == 0 || component.i == '' || component.i == 0 || component.d == 0
    return
  else if op.length == 0
    op.push component
  else
    last = op[op.length - 1]
    if typeof(component) == 'number' && typeof(last) == 'number'
      op[op.length - 1] += component
    else if component.i != undefined && last.i? && typeof(last.i) == typeof(component.i)
      last.i += component.i
    else if component.d != undefined && last.d?
      last.d += component.d
    else
      op.push component
  
# Makes 2 functions for taking components from the start of an op, and for peeking
# at the next op that could be taken.
makeTake = (op) ->
  # The index of the next component to take
  index = 0
  # The offset into the component
  offset = 0

  # Take up to length maxlength from the op. If maxlength is not defined, there is no max.
  # If insertsIndivisible is true, inserts (& insert tombstones) won't be separated.
  #
  # Returns null when op is fully consumed.
  take = (maxlength, insertsIndivisible) ->
    return null if index == op.length

    e = op[index]
    if typeof((current = e)) == 'number' or typeof((current = e.i)) == 'number' or (current = e.d) != undefined
      if !maxlength? or current - offset <= maxlength or (insertsIndivisible and e.i != undefined)
        # Return the rest of the current element.
        c = current - offset
        ++index; offset = 0
      else
        offset += maxlength
        c = maxlength
      if e.i != undefined then {i:c} else if e.d != undefined then {d:c} else c
    else
      # Take from the inserted string
      if !maxlength? or e.i.length - offset <= maxlength or insertsIndivisible
        result = {i:e.i[offset..]}
        ++index; offset = 0
      else
        result = {i:e.i[offset...offset + maxlength]}
        offset += maxlength
      result
  
  peekType = -> op[index]
  
  [take, peekType]

# Find and return the length of an op component
componentLength = (component) ->
  if typeof(component) == 'number'
    component
  else if typeof(component.i) == 'string'
    component.i.length
  else
    # This should work because c.d and c.i must be +ive.
    component.d or component.i

# Normalize an op, removing all empty skips and empty inserts / deletes. Concatenate
# adjacent inserts and deletes.
type.normalize = (op) ->
  newOp = []
  append newOp, component for component in op
  newOp

# This is a helper method to transform and prune. goForwards is true for transform, false for prune.
transformer = (op, otherOp, goForwards, side) ->
  checkOp op
  checkOp otherOp
  newOp = []

  [take, peek] = makeTake op

  for component in otherOp
    length = componentLength component

    if component.i != undefined # Insert text or tombs
      if goForwards # transform - insert skips over inserted parts
        if side == 'left'
          # The left insert should go first.
          append newOp, take() while peek()?.i != undefined

        # In any case, skip the inserted text.
        append newOp, length

      else # Prune. Remove skips for inserts.
        while length > 0
          chunk = take length, true

          throw new Error 'The transformed op is invalid' unless chunk != null
          throw new Error 'The transformed op deletes locally inserted characters - it cannot be purged of the insert.' if chunk.d != undefined

          if typeof chunk is 'number'
            length -= chunk
          else
            append newOp, chunk

    else # Skip or delete
      while length > 0
        chunk = take length, true
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        append newOp, chunk
        length -= componentLength chunk unless chunk.i
  
  # Append extras from op1
  while (component = take())
    throw new Error "Remaining fragments in the op: #{component}" unless component.i != undefined
    append newOp, component

  newOp

# transform op1 by op2. Return transformed version of op1.
# op1 and op2 are unchanged by transform.
# side should be 'left' or 'right', depending on if op1.id <> op2.id. 'left' == client op.
type.transform = (op, otherOp, side) ->
  throw new Error "side (#{side}) should be 'left' or 'right'" unless side == 'left' or side == 'right'
  transformer op, otherOp, true, side

# Prune is the inverse of transform.
type.prune = (op, otherOp) -> transformer op, otherOp, false

# Compose 2 ops into 1 op.
type.compose = (op1, op2) ->
  return op2 if op1 == null or op1 == undefined

  checkOp op1
  checkOp op2

  result = []

  [take, _] = makeTake op1

  for component in op2

    if typeof(component) == 'number' # Skip
      # Just copy from op1.
      length = component
      while length > 0
        chunk = take length
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        append result, chunk
        length -= componentLength chunk

    else if component.i != undefined # Insert
      append result, {i:component.i}

    else # Delete
      length = component.d
      while length > 0
        chunk = take length
        throw new Error('The op traverses more elements than the document has') unless chunk != null

        chunkLength = componentLength chunk
        if chunk.i != undefined
          append result, {i:chunkLength}
        else
          append result, {d:chunkLength}

        length -= chunkLength
    
  # Append extras from op1
  while (component = take())
    throw new Error "Remaining fragments in op1: #{component}" unless component.i != undefined
    append result, component

  result

if WEB?
  exports.types['text-tp2'] = type
else
  module.exports = type

