const TextOperation = require('../../lib/operation/text_operation')
const random = require('./random')

/**
 *
 * @param {string} str
 * @returns {TextOperation}
 */
function randomTextOperation(str) {
  const operation = new TextOperation()
  let left
  while (true) {
    left = str.length - operation.baseLength
    if (left === 0) break
    const r = Math.random()
    const l = 1 + random.int(Math.min(left - 1, 20))
    if (r < 0.2) {
      operation.insert(random.string(l))
    } else if (r < 0.4) {
      operation.remove(l)
    } else {
      operation.retain(l)
    }
  }
  if (Math.random() < 0.3) {
    operation.insert(1 + random.string(10))
  }
  return operation
}

module.exports = randomTextOperation
