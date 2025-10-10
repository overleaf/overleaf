const TrackingProps = require('../../../lib/file_data/tracking_props')
const ClearTrackingProps = require('../../../lib/file_data/clear_tracking_props')
const TextOperation = require('../../../lib/operation/text_operation')
const random = require('./random')

/**
 *
 * @param {string} str
 * @param {string[]} [commentIds]
 * @returns {TextOperation}
 */
function randomTextOperation(str, commentIds) {
  const operation = new TextOperation()
  let left
  while (true) {
    left = str.length - operation.baseLength
    if (left === 0) break
    const r = Math.random()
    const l = 1 + random.int(Math.min(left - 1, 20))
    const trackedChange =
      Math.random() < 0.1
        ? new TrackingProps(
            random.element(['insert', 'delete']),
            random.element(['user1', 'user2', 'user3']),
            new Date(
              random.element([
                '2024-01-01T00:00:00.000Z',
                '2023-01-01T00:00:00.000Z',
                '2022-01-01T00:00:00.000Z',
              ])
            )
          )
        : undefined
    if (r < 0.2) {
      let operationCommentIds
      if (commentIds?.length > 0 && Math.random() < 0.3) {
        operationCommentIds = random.subset(commentIds)
      }
      operation.insert(random.string(l), {
        tracking: trackedChange,
        commentIds: operationCommentIds,
      })
    } else if (r < 0.4) {
      operation.remove(l)
    } else if (r < 0.5) {
      operation.retain(l, { tracking: new ClearTrackingProps() })
    } else {
      operation.retain(l, { tracking: trackedChange })
    }
  }
  if (Math.random() < 0.3) {
    operation.insert(1 + random.string(10))
  }
  return operation
}

module.exports = randomTextOperation
