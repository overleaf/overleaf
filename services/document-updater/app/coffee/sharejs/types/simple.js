# This is a really simple OT type. Its not compiled with the web client, but it could be.
#
# Its mostly included for demonstration purposes and its used in a lot of unit tests.
#
# This defines a really simple text OT type which only allows inserts. (No deletes).
#
# Ops look like:
#   {position:#, text:"asdf"}
#
# Document snapshots look like:
#   {str:string}

module.exports =
  # The name of the OT type. The type is stored in types[type.name]. The name can be
  # used in place of the actual type in all the API methods.
  name: 'simple'

  # Create a new document snapshot
  create: -> {str:""}

  # Apply the given op to the document snapshot. Returns the new snapshot.
  #
  # The original snapshot should not be modified.
  apply: (snapshot, op) ->
    throw new Error 'Invalid position' unless 0 <= op.position <= snapshot.str.length

    str = snapshot.str
    str = str.slice(0, op.position) + op.text + str.slice(op.position)
    {str}

  # transform op1 by op2. Return transformed version of op1.
  # sym describes the symmetry of the op. Its 'left' or 'right' depending on whether the
  # op being transformed comes from the client or the server.
  transform: (op1, op2, sym) ->
    pos = op1.position
    pos += op2.text.length if op2.position < pos or (op2.position == pos and sym is 'left')

    return {position:pos, text:op1.text}
