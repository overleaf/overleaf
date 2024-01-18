const Metrics = require('@overleaf/metrics')
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
const Features = require('../../infrastructure/Features')
const SplitTestUtils = require('./SplitTestUtils')
const Settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const logger = require('@overleaf/logger')

const DEFAULT_VARIANT = 'default'
const ALPHA_PHASE = 'alpha'
const BETA_PHASE = 'beta'
const CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER = null
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

  try {
    if (!Features.hasFeature('saas')) {
      assignment = _getNonSaasAssignment(splitTestName)
    } else {
      await _loadSplitTestInfoInLocals(res.locals, splitTestName, req.session)

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
        _collectSessionStats(req.session)
      }
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to get split test assignment')
    assignment = DEFAULT_ASSIGNMENT
  }

  LocalsHelper.setSplitTestVariant(
    res.locals,
    splitTestName,
    assignment.variant
  )

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
  try {
    if (!Features.hasFeature('saas')) {
      return _getNonSaasAssignment(splitTestName)
    }

    const analyticsId = await UserAnalyticsIdCache.get(userId)
    return _getAssignment(splitTestName, { analyticsId, userId, sync })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get split test assignment for user')
    return DEFAULT_ASSIGNMENT
  }
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
  try {
    if (!Features.hasFeature('saas')) {
      return _getNonSaasAssignment(splitTestName)
    }

    return _getAssignment(splitTestName, {
      analyticsId: await UserAnalyticsIdCache.get(user._id),
      sync,
      user,
      userId: user._id.toString(),
    })
  } catch (error) {
    logger.error(
      { err: error },
      'Failed to get split test assignment for mongo user'
    )
    return DEFAULT_ASSIGNMENT
  }
}

/**
 * Get a mapping of the active split test assignments for the given user
 */
async function getActiveAssignmentsForUser(userId, removeArchived = false) {
  if (!Features.hasFeature('saas')) {
    return {}
  }

  const user = await _getUser(userId)
  if (user == null) {
    return {}
  }

  const splitTests = await SplitTest.find({
    $where: 'this.versions[this.versions.length - 1].active',
    ...(removeArchived && { archived: { $ne: true } }),
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
 * @param {import('express').Request} req
 * @param {Object|null} user optional, prefetched user with alphaProgram and betaProgram field
 * @return {Promise<void>}
 */
async function sessionMaintenance(req, user) {
  const session = req.session
  const sessionUser = SessionManager.getSessionUser(session)

  Metrics.inc('split_test_session_maintenance', 1, { status: 'start' })
  if (sessionUser) {
    user = user || (await _getUser(sessionUser._id))
    if (
      Boolean(sessionUser.alphaProgram) !== Boolean(user.alphaProgram) ||
      Boolean(sessionUser.betaProgram) !== Boolean(user.betaProgram)
    ) {
      Metrics.inc('split_test_session_maintenance', 1, {
        status: 'program-change',
      })
      sessionUser.alphaProgram = user.alphaProgram || undefined // only store if set
      sessionUser.betaProgram = user.betaProgram || undefined // only store if set
      session.cachedSplitTestAssignments = {}
    }
  }

  // TODO: After changing the split test config fetching: remove split test assignments for archived split tests
}

/**
 * Returns an array of valid variant names for the given split test, including default
 *
 * @param splitTestName
 * @returns {Promise<string[]>}
 * @private
 */
async function _getVariantNames(splitTestName) {
  const splitTest = await _getSplitTest(splitTestName)
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

  const splitTest = await _getSplitTest(splitTestName)
  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)

  if (Settings.splitTest.devToolbar.enabled) {
    const override = session?.splitTestOverrides?.[splitTestName]
    if (override) {
      return _makeAssignment(splitTest, override, currentVersion)
    }
  }

  if (!currentVersion?.active) {
    return DEFAULT_ASSIGNMENT
  }

  // Do not cache assignments for anonymous users. All the context for their assignments is in the session:
  // They cannot be part of the alpha or beta program, and they will use their analyticsId for assignments.
  const canUseSessionCache = session && SessionManager.isUserLoggedIn(session)
  if (session && !canUseSessionCache) {
    // Purge the existing cache
    delete session.cachedSplitTestAssignments
  }

  if (canUseSessionCache) {
    const cachedVariant = _getCachedVariantFromSession(
      session,
      splitTest.name,
      currentVersion
    )
    if (cachedVariant === CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER) {
      Metrics.inc('split_test_get_assignment_source', 1, { status: 'cache' })
      return DEFAULT_ASSIGNMENT
    }
    if (cachedVariant) {
      Metrics.inc('split_test_get_assignment_source', 1, { status: 'cache' })
      return _makeAssignment(splitTest, cachedVariant, currentVersion)
    }
  }

  if (user) {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'provided' })
  } else if (userId) {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'mongo' })
  } else {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'none' })
  }

  user = user || (userId && (await _getUser(userId, splitTestName)))
  const { activeForUser, selectedVariantName, phase, versionNumber } =
    await _getAssignmentMetadata(analyticsId, user, splitTest)
  if (canUseSessionCache) {
    _setVariantInSession({
      session,
      splitTestName,
      currentVersion,
      selectedVariantName,
      activeForUser,
    })
  }
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

function setOverrideInSession(session, splitTestName, variantName) {
  if (!Settings.splitTest.devToolbar.enabled) {
    return
  }
  if (!session.splitTestOverrides) {
    session.splitTestOverrides = {}
  }
  session.splitTestOverrides[splitTestName] = variantName
}

function clearOverridesInSession(session) {
  delete session.splitTestOverrides
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
    user = user || (await _getUser(userId, splitTestName))
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
      segmentation: splitTest
        ? {
            splitTest: splitTest.name,
            variant,
            phase: currentVersion.phase,
            versionNumber: currentVersion.versionNumber,
          }
        : {},
    },
  }
}

function _getCachedVariantFromSession(session, splitTestName, currentVersion) {
  if (!session.cachedSplitTestAssignments) {
    session.cachedSplitTestAssignments = {}
  }
  const cacheKey = `${splitTestName}-${currentVersion.versionNumber}`
  return session.cachedSplitTestAssignments[cacheKey]
}

function _setVariantInSession({
  session,
  splitTestName,
  currentVersion,
  selectedVariantName,
  activeForUser,
}) {
  if (!session.cachedSplitTestAssignments) {
    session.cachedSplitTestAssignments = {}
  }

  // clean up previous entries from this split test
  for (const cacheKey of Object.keys(session.cachedSplitTestAssignments)) {
    // drop '-versionNumber'
    const name = cacheKey.split('-').slice(0, -1).join('-')
    if (name === splitTestName) {
      delete session.cachedSplitTestAssignments[cacheKey]
    }
  }

  const cacheKey = `${splitTestName}-${currentVersion.versionNumber}`
  if (activeForUser) {
    session.cachedSplitTestAssignments[cacheKey] = selectedVariantName
  } else {
    session.cachedSplitTestAssignments[cacheKey] =
      CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER
  }
}

async function _getUser(id, splitTestName) {
  const projection = {
    analyticsId: 1,
    alphaProgram: 1,
    betaProgram: 1,
  }
  if (splitTestName) {
    projection[`splitTests.${splitTestName}`] = 1
  } else {
    projection.splitTests = 1
  }
  const user = await UserGetter.promises.getUser(id, projection)
  Metrics.histogram(
    'split_test_get_user_from_mongo_size',
    JSON.stringify(user).length,
    [0, 100, 500, 1000, 2000, 5000, 10000, 15000, 20000, 50000, 100000]
  )
  return user
}

async function _loadSplitTestInfoInLocals(locals, splitTestName, session) {
  const splitTest = await _getSplitTest(splitTestName)
  if (splitTest) {
    const override = session?.splitTestOverrides?.[splitTestName]

    const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
    if (!currentVersion.active && !Settings.splitTest.devToolbar.enabled) {
      return
    }

    const phase = currentVersion.phase
    const info = {
      phase,
      badgeInfo: splitTest.badgeInfo?.[phase],
    }
    if (Settings.splitTest.devToolbar.enabled) {
      info.active = currentVersion.active
      info.variants = currentVersion.variants.map(variant => ({
        name: variant.name,
        rolloutPercent: variant.rolloutPercent,
      }))
      info.hasOverride = !!override
    }
    LocalsHelper.setSplitTestInfo(locals, splitTestName, info)
  } else if (Settings.splitTest.devToolbar.enabled) {
    LocalsHelper.setSplitTestInfo(locals, splitTestName, {
      missing: true,
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

function _collectSessionStats(session) {
  if (session.cachedSplitTestAssignments) {
    Metrics.summary(
      'split_test_session_cache_count',
      Object.keys(session.cachedSplitTestAssignments).length
    )
    Metrics.summary(
      'split_test_session_cache_size',
      JSON.stringify(session.cachedSplitTestAssignments).length
    )
  }
  if (session.splitTests) {
    Metrics.summary(
      'split_test_session_storage_count',
      Object.keys(session.splitTests).length
    )
    Metrics.summary(
      'split_test_session_storage_size',
      JSON.stringify(session.splitTests).length
    )
  }
}

async function _getSplitTest(name) {
  const splitTests = await SplitTestCache.get('')
  return splitTests?.get(name)
}

module.exports = {
  getPercentile,
  getAssignment: callbackify(getAssignment),
  getAssignmentForMongoUser: callbackify(getAssignmentForMongoUser),
  getAssignmentForUser: callbackify(getAssignmentForUser),
  getActiveAssignmentsForUser: callbackify(getActiveAssignmentsForUser),
  sessionMaintenance: callbackify(sessionMaintenance),
  setOverrideInSession,
  clearOverridesInSession,
  promises: {
    getAssignment,
    getAssignmentForMongoUser,
    getAssignmentForUser,
    getActiveAssignmentsForUser,
    sessionMaintenance,
  },
}
