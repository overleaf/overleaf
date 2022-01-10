const SplitTestV2Handler = require('./SplitTestV2Handler')
const SplitTestCache = require('./SplitTestCache')
const LocalsHelper = require('./LocalsHelper')
const logger = require('@overleaf/logger')

function loadAssignmentsInLocals(splitTestNames) {
  return async function (req, res, next) {
    try {
      if (!req.session.cachedSplitTestAssignments) {
        req.session.cachedSplitTestAssignments = {}
      }
      for (const splitTestName of splitTestNames) {
        if (req.query[splitTestName]) {
          LocalsHelper.setSplitTestVariant(
            res.locals,
            splitTestName,
            req.query[splitTestName]
          )
        } else {
          const splitTest = await SplitTestCache.get(splitTestName)
          if (splitTest) {
            await _loadAssignmentInLocals(splitTest, req.session, res.locals)
          }
        }
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

async function _loadAssignmentInLocals(splitTest, session, locals) {
  const currentVersion = splitTest.getCurrentVersion()
  const cacheKey = `${splitTest.name}-${currentVersion.versionNumber}`
  if (currentVersion.active) {
    const cachedVariant = session.cachedSplitTestAssignments[cacheKey]
    if (cachedVariant) {
      LocalsHelper.setSplitTestVariant(locals, splitTest.name, cachedVariant)
    } else {
      const assignment =
        await SplitTestV2Handler.promises.getAssignmentForSession(
          session,
          splitTest.name
        )
      session.cachedSplitTestAssignments[cacheKey] = assignment.variant
      LocalsHelper.setSplitTestVariant(
        locals,
        splitTest.name,
        assignment.variant
      )
    }
  } else {
    delete session.cachedSplitTestAssignments[cacheKey]
  }
}

module.exports = {
  loadAssignmentsInLocals,
}
