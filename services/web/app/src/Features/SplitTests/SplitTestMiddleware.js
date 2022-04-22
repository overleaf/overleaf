const SplitTestHandler = require('./SplitTestHandler')
const logger = require('@overleaf/logger')

function loadAssignmentsInLocals(splitTestNames) {
  return async function (req, res, next) {
    try {
      for (const splitTestName of splitTestNames) {
        await SplitTestHandler.promises.getAssignment(req, res, splitTestName)
      }
    } catch (error) {
      logger.error(
        { err: error, splitTestNames },
        'Failed to load split test assignments in express locals in middleware'
      )
    }
    next()
  }
}

module.exports = {
  loadAssignmentsInLocals,
}
