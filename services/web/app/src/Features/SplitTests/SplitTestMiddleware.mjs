import SplitTestHandler from './SplitTestHandler.mjs'
import logger from '@overleaf/logger'
import { expressify } from '@overleaf/promise-utils'
import Errors from '../Errors/Errors.js'

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

export default {
  loadAssignmentsInLocals,
  ensureSplitTestEnabledForUser,
}
