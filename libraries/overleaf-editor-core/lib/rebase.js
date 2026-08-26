// @ts-check

'use strict'

const Operation = require('./operation')

/**
 * @typedef {import('./change')} Change
 */

/**
 * Rebase changes onto the changes another writer got in first.
 *
 * `Operation.transformMultiple` rewrites *both* operation lists in place, which
 * is what makes a sequence of our changes come out right: each of ours is
 * transformed against their change as it stands after our earlier ones, rather
 * than against the original.
 *
 * Operations that transform down to a no-op are pruned, and a change left with
 * none is dropped, so the result contains only changes that still carry an
 * operation. An empty result means everything we had was already accounted for
 * by theirs.
 *
 * Only the operations are touched. A change's `origin`, `authors`, `v2Authors`
 * and `timestamp` travel through untouched, which is what lets a caller
 * recognise one of its own changes read back from history after it has been
 * rebased.
 *
 * @param {Change[]} ours modified in place
 * @param {Change[]} theirs the intervening changes, in version order
 * @return {Change[]} the subset of `ours` that still carries an operation
 */
function rebaseChanges(ours, theirs) {
  for (const change of theirs) {
    const theirOperations = change.getOperations()
    for (const ourChange of ours) {
      Operation.transformMultiple(ourChange.getOperations(), theirOperations)
    }
  }

  const rebased = []
  for (const change of ours) {
    const operations = change
      .getOperations()
      .filter(operation => !operation.isNoOp())
    if (operations.length === 0) continue
    change.setOperations(operations)
    rebased.push(change)
  }
  return rebased
}

module.exports = rebaseChanges
