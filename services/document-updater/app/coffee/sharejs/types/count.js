# This is a simple type used for testing other OT code. Each op is [expectedSnapshot, increment]

exports.name = 'count'
exports.create = -> 1

exports.apply = (snapshot, op) ->
  [v, inc] = op
  throw new Error "Op #{v} != snapshot #{snapshot}" unless snapshot == v
  snapshot + inc

# transform op1 by op2. Return transformed version of op1.
exports.transform = (op1, op2) ->
  throw new Error "Op1 #{op1[0]} != op2 #{op2[0]}" unless op1[0] == op2[0]
  [op1[0] + op2[1], op1[1]]

exports.compose = (op1, op2) ->
  throw new Error "Op1 #{op1} + 1 != op2 #{op2}" unless op1[0] + op1[1] == op2[0]
  [op1[0], op1[1] + op2[1]]

exports.generateRandomOp = (doc) ->
  [[doc, 1], doc + 1]

