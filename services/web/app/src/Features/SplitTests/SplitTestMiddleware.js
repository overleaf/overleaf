const SplitTestHandler = require('./SplitTestHandler')
const logger = require('@overleaf/logger')
const { expressify } = require('@overleaf/promise-utils')
const Errors = require('../Errors/Errors')

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

function ensureSplitTestEnabledForUser(
  splitTestName,
  enabledVariant = 'enabled'
) {
  return expressify(async function (req, res, next) {
    const { variant } = await SplitTestHandler.promises.getAssignment(
      req,
      res,
      splitTestName
    )
    if (variant !== enabledVariant) {
      throw new Errors.ForbiddenError({
        message: 'missing split test access',
        info: {
          splitTestName,
          variant,
          enabledVariant,
        },
      })
    }
    next()
  })
}

module.exports = {
  loadAssignmentsInLocals,
  ensureSplitTestEnabledForUser,
}
