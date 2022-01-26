const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const LocalsHelper = require('./LocalsHelper')
const crypto = require('crypto')
const _ = require('lodash')
const { callbackify } = require('util')
const SplitTestCache = require('./SplitTestCache')

const DEFAULT_VARIANT = 'default'
const ALPHA_PHASE = 'alpha'
const BETA_PHASE = 'beta'
const DEFAULT_ASSIGNMENT = {
  variant: DEFAULT_VARIANT,
  analytics: {
    segmentation: {},
  },
}

/**
 * Get the assignment of a user to a split test by their session.
 *
 * @example
 * // Assign user and record an event
 *
 * const assignment = await SplitTestHandler.getAssignment(req.session, 'example-project')
 * if (assignment.variant === 'awesome-new-version') {
 *   // execute my awesome change
 * }
 * else {
 *   // execute the default behaviour (control group)
 * }
 * // then record an event
 * AnalyticsManager.recordEventForSession(req.session, 'example-project-created', {
 *   projectId: project._id,
 *   ...assignment.analytics.segmentation
 * })
 *
 * @param req the request
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignment(req, splitTestName, { sync = false } = {}) {
  const query = req.query || {}
  if (query[splitTestName]) {
    return {
      variant: query[splitTestName],
      analytics: {
        segmentation: {},
      },
    }
  }
  const { userId, analyticsId } = AnalyticsManager.getIdsFromSession(
    req.session
  )
  return _getAssignment(splitTestName, {
    analyticsId,
    userId,
    session: req.session,
    sync,
  })
}

/**
 * Get the assignment of a user to a split test by their user ID.
 *
 * Warning: this does not support query parameters override. Wherever possible, `getAssignment` should be used instead.
 *
 * @param userId the user ID
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignmentForUser(
  userId,
  splitTestName,
  { sync = false } = {}
) {
  return _getAssignment(splitTestName, { userId, sync })
}

/**
 * Get the assignment of a user to a split test by their session and stores it in the locals context.
 *
 * @param req the request
 * @param res the Express response object
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<void>}
 */
async function assignInLocalsContext(
  req,
  res,
  splitTestName,
  { sync = false } = {}
) {
  const assignment = await getAssignment(req, splitTestName, { sync })
  LocalsHelper.setSplitTestVariant(
    res.locals,
    splitTestName,
    assignment.variant
  )
}

/**
 * Get a mapping of the active split test assignments for the given user
 */
async function getActiveAssignmentsForUser(userId) {
  const user = await UserGetter.promises.getUser(userId, { splitTests: 1 })
  if (user == null || user.splitTests == null) {
    return {}
  }
  const activeAssignments = {}
  for (const [splitTestName, assignments] of Object.entries(user.splitTests)) {
    const splitTest = await SplitTestCache.get(splitTestName)
    if (splitTest == null) {
      continue
    }
    const currentVersion = splitTest.getCurrentVersion()
    if (!currentVersion || !currentVersion.active) {
      continue
    }

    let assignment
    if (Array.isArray(assignments)) {
      assignment = _.maxBy(assignments, 'versionNumber')
    } else {
      // Older format is a single string rather than an array of objects
      assignment = { variantName: assignments }
    }
    activeAssignments[splitTestName] = assignment
  }
  return activeAssignments
}

async function _getAssignment(
  splitTestName,
  { analyticsId, userId, session, sync }
) {
  if (!analyticsId && !userId) {
    return DEFAULT_ASSIGNMENT
  }

  const splitTest = await SplitTestCache.get(splitTestName)
  const currentVersion = splitTest?.getCurrentVersion()
  if (!splitTest || !currentVersion?.active) {
    return DEFAULT_ASSIGNMENT
  }

  if (session) {
    const cachedVariant = _getCachedVariantFromSession(
      session,
      splitTest.name,
      currentVersion
    )
    if (cachedVariant) {
      return _makeAssignment(splitTest, cachedVariant, currentVersion)
    }
  }
  const { activeForUser, selectedVariantName, phase, versionNumber } =
    await _getAssignmentMetadata(analyticsId, userId, splitTest)
  if (activeForUser) {
    const assignmentConfig = {
      userId,
      analyticsId,
      session,
      splitTestName,
      variantName: selectedVariantName,
      phase,
      versionNumber,
    }
    if (sync === true) {
      await _updateVariantAssignment(assignmentConfig)
    } else {
      _updateVariantAssignment(assignmentConfig)
    }
    return _makeAssignment(splitTest, selectedVariantName, currentVersion)
  }

  return DEFAULT_ASSIGNMENT
}

async function _getAssignmentMetadata(analyticsId, userId, splitTest) {
  const currentVersion = splitTest.getCurrentVersion()
  const phase = currentVersion.phase
  if ([ALPHA_PHASE, BETA_PHASE].includes(phase)) {
    if (userId) {
      const user = await _getUser(userId)
      if (
        (phase === ALPHA_PHASE && !(user && user.alphaProgram)) ||
        (phase === BETA_PHASE && !(user && user.betaProgram))
      ) {
        return {
          activeForUser: false,
        }
      }
    } else {
      return {
        activeForUser: false,
      }
    }
  }
  const percentile = _getPercentile(
    analyticsId || userId,
    splitTest.name,
    phase
  )
  const selectedVariantName = _getVariantFromPercentile(
    currentVersion.variants,
    percentile
  )
  return {
    activeForUser: true,
    selectedVariantName: selectedVariantName || DEFAULT_VARIANT,
    phase,
    versionNumber: currentVersion.versionNumber,
  }
}

function _getPercentile(analyticsId, splitTestName, splitTestPhase) {
  const hash = crypto
    .createHash('md5')
    .update(analyticsId + splitTestName + splitTestPhase)
    .digest('hex')
  const hashPrefix = hash.substr(0, 8)
  return Math.floor(
    ((parseInt(hashPrefix, 16) % 0xffffffff) / 0xffffffff) * 100
  )
}

function _getVariantFromPercentile(variants, percentile) {
  for (const variant of variants) {
    for (const stripe of variant.rolloutStripes) {
      if (percentile >= stripe.start && percentile < stripe.end) {
        return variant.name
      }
    }
  }
}

async function _updateVariantAssignment({
  userId,
  analyticsId,
  session,
  splitTestName,
  phase,
  versionNumber,
  variantName,
}) {
  const persistedAssignment = {
    variantName,
    versionNumber,
    phase,
    assignedAt: new Date(),
  }
  // if the user is logged in
  if (userId) {
    const user = await _getUser(userId)
    if (user) {
      const assignedSplitTests = user.splitTests || []
      const assignmentLog = assignedSplitTests[splitTestName] || []
      const existingAssignment = _.find(assignmentLog, { versionNumber })
      if (!existingAssignment) {
        await UserUpdater.promises.updateUser(userId, {
          $addToSet: {
            [`splitTests.${splitTestName}`]: persistedAssignment,
          },
        })
        AnalyticsManager.setUserPropertyForAnalyticsId(
          user.analyticsId || analyticsId || userId,
          `split-test-${splitTestName}-${versionNumber}`,
          variantName
        )
      }
    }
  }
  // otherwise this is an anonymous user, we store assignments in session to persist them on registration
  else if (session) {
    if (!session.splitTests) {
      session.splitTests = {}
    }
    if (!session.splitTests[splitTestName]) {
      session.splitTests[splitTestName] = []
    }
    const existingAssignment = _.find(session.splitTests[splitTestName], {
      versionNumber,
    })
    if (!existingAssignment) {
      session.splitTests[splitTestName].push(persistedAssignment)
      AnalyticsManager.setUserPropertyForAnalyticsId(
        analyticsId,
        `split-test-${splitTestName}-${versionNumber}`,
        variantName
      )
    }
  }
}

function _makeAssignment(splitTest, variant, currentVersion) {
  return {
    variant,
    analytics: {
      segmentation: {
        splitTest: splitTest.name,
        variant,
        phase: currentVersion.phase,
        versionNumber: currentVersion.versionNumber,
      },
    },
  }
}

function _getCachedVariantFromSession(session, splitTestName, currentVersion) {
  if (!session.cachedSplitTestAssignments) {
    session.cachedSplitTestAssignments = {}
    return
  }
  const cacheKey = `${splitTestName}-${currentVersion.versionNumber}`
  if (currentVersion.active) {
    return session.cachedSplitTestAssignments[cacheKey]
  } else {
    delete session.cachedSplitTestAssignments[cacheKey]
  }
}

async function _getUser(id) {
  return UserGetter.promises.getUser(id, {
    splitTests: 1,
    alphaProgram: 1,
    betaProgram: 1,
  })
}

module.exports = {
  getAssignment: callbackify(getAssignment),
  getAssignmentForUser: callbackify(getAssignmentForUser),
  getActiveAssignmentsForUser: callbackify(getActiveAssignmentsForUser),
  assignInLocalsContext: callbackify(assignInLocalsContext),
  promises: {
    getAssignment,
    getAssignmentForUser,
    getActiveAssignmentsForUser,
    assignInLocalsContext,
  },
}
