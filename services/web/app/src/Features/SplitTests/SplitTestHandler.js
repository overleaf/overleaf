const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const LocalsHelper = require('./LocalsHelper')
const crypto = require('crypto')
const _ = require('lodash')
const { callbackify } = require('util')
const SplitTestCache = require('./SplitTestCache')
const { SplitTest } = require('../../models/SplitTest')
const UserAnalyticsIdCache = require('../Analytics/UserAnalyticsIdCache')
const { getAnalyticsIdFromMongoUser } = require('../Analytics/AnalyticsHelper')
const Features = require('../../infrastructure/Features')
const SplitTestUtils = require('./SplitTestUtils')
const Settings = require('@overleaf/settings')

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
 * Get the assignment of a user to a split test and store it in the response locals context
 *
 * @example
 * // Assign user and record an event
 *
 * const assignment = await SplitTestHandler.getAssignment(req, res, 'example-project')
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
 * @param res the Express response object
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignment(req, res, splitTestName, { sync = false } = {}) {
  const query = req.query || {}
  let assignment

  if (!Features.hasFeature('saas')) {
    assignment = _getNonSaasAssignment(splitTestName)
  } else {
    // Check the query string for an override, ignoring an invalid value
    const queryVariant = query[splitTestName]
    if (queryVariant) {
      const variants = await _getVariantNames(splitTestName)
      if (variants.includes(queryVariant)) {
        assignment = {
          variant: queryVariant,
          analytics: {
            segmentation: {},
          },
        }
      }
    }

    if (!assignment) {
      const { userId, analyticsId } = AnalyticsManager.getIdsFromSession(
        req.session
      )
      assignment = await _getAssignment(splitTestName, {
        analyticsId,
        userId,
        session: req.session,
        sync,
      })
    }
  }

  LocalsHelper.setSplitTestVariant(
    res.locals,
    splitTestName,
    assignment.variant
  )
  await _loadSplitTestInfoInLocals(res.locals, splitTestName)
  return assignment
}

/**
 * Get the assignment of a user to a split test by their user ID.
 *
 * Warning: this does not support query parameters override, nor makes the assignment and split test info available to
 * the frontend through locals. Wherever possible, `getAssignment` should be used instead.
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
  if (!Features.hasFeature('saas')) {
    return _getNonSaasAssignment(splitTestName)
  }

  const analyticsId = await UserAnalyticsIdCache.get(userId)
  return _getAssignment(splitTestName, { analyticsId, userId, sync })
}

/**
 * Get the assignment of a user to a split test by their pre-fetched mongo doc.
 *
 * Warning: this does not support query parameters override, nor makes the assignment and split test info available to
 * the frontend through locals. Wherever possible, `getAssignment` should be used instead.
 *
 * @param user the user
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<{variant: string, analytics: {segmentation: {splitTest: string, variant: string, phase: string, versionNumber: number}|{}}}>}
 */
async function getAssignmentForMongoUser(
  user,
  splitTestName,
  { sync = false } = {}
) {
  if (!Features.hasFeature('saas')) {
    return _getNonSaasAssignment(splitTestName)
  }

  return _getAssignment(splitTestName, {
    analyticsId: getAnalyticsIdFromMongoUser(user),
    sync,
    user,
    userId: user._id.toString(),
  })
}

/**
 * Get a mapping of the active split test assignments for the given user
 */
async function getActiveAssignmentsForUser(userId) {
  if (!Features.hasFeature('saas')) {
    return {}
  }

  const user = await _getUser(userId)
  if (user == null) {
    return {}
  }

  const splitTests = await SplitTest.find({
    $where: 'this.versions[this.versions.length - 1].active',
  }).exec()
  const assignments = {}
  for (const splitTest of splitTests) {
    const { activeForUser, selectedVariantName, phase, versionNumber } =
      await _getAssignmentMetadata(user.analyticsId, user, splitTest)
    if (activeForUser) {
      const assignment = {
        variantName: selectedVariantName,
        versionNumber,
        phase,
      }
      const userAssignments = user.splitTests?.[splitTest.name]
      if (Array.isArray(userAssignments)) {
        const userAssignment = userAssignments.find(
          x => x.versionNumber === versionNumber
        )
        if (userAssignment) {
          assignment.assignedAt = userAssignment.assignedAt
        }
      }
      assignments[splitTest.name] = assignment
    }
  }
  return assignments
}

/**
 * Returns an array of valid variant names for the given split test, including default
 *
 * @param splitTestName
 * @returns {Promise<string[]>}
 * @private
 */
async function _getVariantNames(splitTestName) {
  const splitTest = await SplitTestCache.get(splitTestName)
  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (currentVersion?.active) {
    return currentVersion.variants.map(v => v.name).concat([DEFAULT_VARIANT])
  } else {
    return [DEFAULT_VARIANT]
  }
}

async function _getAssignment(
  splitTestName,
  { analyticsId, user, userId, session, sync }
) {
  if (!analyticsId && !userId) {
    return DEFAULT_ASSIGNMENT
  }

  const splitTest = await SplitTestCache.get(splitTestName)
  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (!currentVersion?.active) {
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
  user = user || (userId && (await _getUser(userId)))
  const { activeForUser, selectedVariantName, phase, versionNumber } =
    await _getAssignmentMetadata(analyticsId, user, splitTest)
  if (activeForUser) {
    const assignmentConfig = {
      user,
      userId,
      analyticsId,
      session,
      splitTestName,
      variantName: selectedVariantName,
      phase,
      versionNumber,
    }
    if (currentVersion.analyticsEnabled) {
      if (sync === true) {
        await _updateVariantAssignment(assignmentConfig)
      } else {
        _updateVariantAssignment(assignmentConfig)
      }
    }
    return _makeAssignment(splitTest, selectedVariantName, currentVersion)
  }

  return DEFAULT_ASSIGNMENT
}

async function _getAssignmentMetadata(analyticsId, user, splitTest) {
  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  const phase = currentVersion.phase
  if (
    (phase === ALPHA_PHASE && !user?.alphaProgram) ||
    (phase === BETA_PHASE && !user?.betaProgram)
  ) {
    return {
      activeForUser: false,
    }
  }
  const userId = user?._id.toString()
  const percentile = getPercentile(analyticsId || userId, splitTest.name, phase)
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

function getPercentile(analyticsId, splitTestName, splitTestPhase) {
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
  user,
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
    user = user || (await _getUser(userId))
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
    analyticsId: 1,
    splitTests: 1,
    alphaProgram: 1,
    betaProgram: 1,
  })
}

async function _loadSplitTestInfoInLocals(locals, splitTestName) {
  const splitTest = await SplitTestCache.get(splitTestName)
  if (splitTest) {
    const phase = SplitTestUtils.getCurrentVersion(splitTest).phase
    LocalsHelper.setSplitTestInfo(locals, splitTestName, {
      phase,
      badgeInfo: splitTest.badgeInfo?.[phase],
    })
  }
}

function _getNonSaasAssignment(splitTestName) {
  if (Settings.splitTestOverrides?.[splitTestName]) {
    return {
      variant: Settings.splitTestOverrides?.[splitTestName],
      analytics: {
        segmentation: {},
      },
    }
  }
  return DEFAULT_ASSIGNMENT
}

module.exports = {
  getPercentile,
  getAssignment: callbackify(getAssignment),
  getAssignmentForMongoUser: callbackify(getAssignmentForMongoUser),
  getAssignmentForUser: callbackify(getAssignmentForUser),
  getActiveAssignmentsForUser: callbackify(getActiveAssignmentsForUser),
  promises: {
    getAssignment,
    getAssignmentForMongoUser,
    getAssignmentForUser,
    getActiveAssignmentsForUser,
  },
}
