const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const UserAnalyticsIdCache = require('../Analytics/UserAnalyticsIdCache')
const LocalsHelper = require('./LocalsHelper')
const crypto = require('crypto')
const _ = require('lodash')
const { callbackify } = require('util')
const splitTestCache = require('./SplitTestCache')

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
 * Get the assignment of a user to a split test.
 *
 * @example
 * // Assign user and record an event
 *
 * const assignment = await SplitTestV2Handler.getAssignment(userId, 'example-project')
 * if (assignment.variant === 'awesome-new-version') {
 *   // execute my awesome change
 * }
 * else {
 *   // execute the default behaviour (control group)
 * }
 * // then record an event
 * AnalyticsManager.recordEventForUser(userId, 'example-project-created', {
 *   projectId: project._id,
 *   ...assignment.analytics.segmentation
 * })
 *
 * @param userId the user's ID
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignment(userId, splitTestName, options) {
  if (!userId) {
    return DEFAULT_ASSIGNMENT
  }
  const analyticsId = await UserAnalyticsIdCache.get(userId)
  return _getAssignment(analyticsId, userId, undefined, splitTestName, options)
}

/**
 * Get the assignment of a user to a split test by their session.
 *
 * @example
 * // Assign user and record an event
 *
 * const assignment = await SplitTestV2Handler.getAssignment(req.session, 'example-project')
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
 * @param session the request session
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignmentForSession(session, splitTestName, options) {
  const { userId, analyticsId } = AnalyticsManager.getIdsFromSession(session)
  return _getAssignment(analyticsId, userId, session, splitTestName, options)
}

/**
 * Get the assignment of a user to a split test by their ID and stores it in the locals context.
 *
 * @param res the Express response object
 * @param userId the user ID
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<void>}
 */
async function assignInLocalsContext(res, userId, splitTestName, options) {
  const assignment = await getAssignment(userId, splitTestName, options)
  LocalsHelper.setSplitTestVariant(
    res.locals,
    splitTestName,
    assignment.variant
  )
}

/**
 * Get the assignment of a user to a split test by their session and stores it in the locals context.
 *
 * @param res the Express response object
 * @param session the request session
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<void>}
 */
async function assignInLocalsContextForSession(
  res,
  session,
  splitTestName,
  options
) {
  const assignment = await getAssignmentForSession(
    session,
    splitTestName,
    options
  )
  LocalsHelper.setSplitTestVariant(
    res.locals,
    splitTestName,
    assignment.variant
  )
}

async function _getAssignment(
  analyticsId,
  userId,
  session,
  splitTestName,
  options
) {
  if (!analyticsId && !userId) {
    return DEFAULT_ASSIGNMENT
  }
  const splitTest = await splitTestCache.get(splitTestName)
  if (splitTest) {
    const currentVersion = splitTest.getCurrentVersion()
    if (currentVersion.active) {
      const {
        activeForUser,
        selectedVariantName,
        phase,
        versionNumber,
      } = await _getAssignmentMetadata(analyticsId, userId, splitTest)
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
        if (options && options.sync === true) {
          await _updateVariantAssignment(assignmentConfig)
        } else {
          _updateVariantAssignment(assignmentConfig)
        }
        return {
          variant: selectedVariantName,
          analytics: {
            segmentation: {
              splitTest: splitTestName,
              variant: selectedVariantName,
              phase,
              versionNumber,
            },
          },
        }
      }
    }
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
  const percentile = _getPercentile(analyticsId, splitTest.name, phase)
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
          analyticsId,
          `split-test-${splitTestName}-${versionNumber}`,
          variantName
        )
      }
    }
  } else if (session) {
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

async function _getUser(id) {
  return UserGetter.promises.getUser(id, {
    splitTests: 1,
    alphaProgram: 1,
    betaProgram: 1,
  })
}

module.exports = {
  getAssignment: callbackify(getAssignment),
  getAssignmentForSession: callbackify(getAssignmentForSession),
  assignInLocalsContext: callbackify(assignInLocalsContext),
  assignInLocalsContextForSession: callbackify(assignInLocalsContextForSession),
  promises: {
    getAssignment,
    getAssignmentForSession,
    assignInLocalsContext,
    assignInLocalsContextForSession,
  },
}
