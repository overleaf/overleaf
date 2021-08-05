// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This is a simple type used for testing other OT code. Each op is [expectedSnapshot, increment]

exports.name = 'count'
exports.create = () => 1

exports.apply = function (snapshot, op) {
  const [v, inc] = Array.from(op)
  if (snapshot !== v) {
    throw new Error(`Op ${v} != snapshot ${snapshot}`)
  }
  return snapshot + inc
}

// transform op1 by op2. Return transformed version of op1.
exports.transform = function (op1, op2) {
  if (op1[0] !== op2[0]) {
    throw new Error(`Op1 ${op1[0]} != op2 ${op2[0]}`)
  }
  return [op1[0] + op2[1], op1[1]]
}

exports.compose = function (op1, op2) {
  if (op1[0] + op1[1] !== op2[0]) {
    throw new Error(`Op1 ${op1} + 1 != op2 ${op2}`)
  }
  return [op1[0], op1[1] + op2[1]]
}

exports.generateRandomOp = doc => [[doc, 1], doc + 1]
