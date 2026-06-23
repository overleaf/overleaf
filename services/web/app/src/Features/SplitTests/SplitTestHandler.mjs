import Metrics from '@overleaf/metrics'
import UserUpdater from '../User/UserUpdater.mjs'
import AnalyticsManager from '../Analytics/AnalyticsManager.mjs'
import LocalsHelper from './LocalsHelper.mjs'
import crypto from 'node:crypto'
import _ from 'lodash'
import { callbackify } from 'node:util'
import SplitTestCache from './SplitTestCache.mjs'
import { SplitTest } from '../../models/SplitTest.mjs'
import UserAnalyticsDataCache from '../Analytics/UserAnalyticsDataCache.mjs'
import Features from '../../infrastructure/Features.mjs'
import SplitTestUtils from './SplitTestUtils.mjs'
import Settings from '@overleaf/settings'
import SessionManager from '../Authentication/SessionManager.mjs'
import logger from '@overleaf/logger'
import SplitTestSessionHandler from './SplitTestSessionHandler.mjs'
import SplitTestUserGetter from './SplitTestUserGetter.mjs'

/**
 * @import { Assignment } from "./types"
 * @import { SplitTestUser } from "./SplitTestUserGetter"
 */

const DEFAULT_VARIANT = 'default'
const ALPHA_PHASE = 'alpha'
const LABS_PHASE = 'labs'
const BETA_PHASE = 'beta'
const RELEASE_PHASE = 'release'
const DEFAULT_ASSIGNMENT = {
  variant: DEFAULT_VARIANT,
  metadata: {},
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
 *
 * @param req the request
 * @param res the Express response object
 * @param splitTestName the unique name of the split test
 * @param {Object} [options]
 * @param {boolean} [options.sync] - for test purposes only, to force the synchronous update of the user's profile
 * @param {boolean} [options.includeReferer] For ajax requests and downloads include the split test overrides of the page
 * @param {boolean} [options.ignoreOverrides] Ignore query-string variant overrides (e.g. for backend gating where the user must not be able to force a variant)
 * @returns {Promise<Assignment>}
 */
async function getAssignment(
  req,
  res,
  splitTestName,
  { sync = false, includeReferer = false, ignoreOverrides = false } = {}
) {
  let assignment

  try {
    if (!Features.hasFeature('saas')) {
      assignment = _getNonSaasAssignment(splitTestName)
    } else {
      await _loadSplitTestInfoInLocals(res.locals, splitTestName, req.session)

      if (!ignoreOverrides) {
        let query = req.query || {}
        if (includeReferer && req.headers.referer) {
          // Pick up the query of the top-level page, i.e. what's in the browsers address bar, from ajax requests.
          // E.g. /project/:id?split-test=foo -> ajax /project/:id/compile should see split-test=foo.
          // E.g. /project/:id?split-test=foo -> redirect /project/:id/download/zip should see split-test=foo.
          try {
            const u = new URL(req.headers.referer, Settings.siteUrl)
            query = {
              ...Object.fromEntries(u.searchParams.entries()),
              ...query,
            }
          } catch {}
        }

        // Check the query string for an override, ignoring an invalid value
        const queryVariant = query[splitTestName]
        if (queryVariant) {
          const variants = await _getVariantNames(splitTestName)
          if (variants.includes(queryVariant)) {
            assignment = {
              variant: queryVariant,
              metadata: {},
            }
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
        SplitTestSessionHandler.collectSessionStats(req.session)
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
 * @returns {Promise<Assignment>}
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

    const analyticsId = await UserAnalyticsDataCache.getAnalyticsId(
      userId,
      `getAssignmentForUser:${splitTestName}`
    )
    return _getAssignment(splitTestName, { analyticsId, userId, sync })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get split test assignment for user')
    return DEFAULT_ASSIGNMENT
  }
}

/**
 * Get the assignment of a user to a split test from an already-fetched mongo user.
 *
 * The user must include all the relevant fields. Unless you fetch the full user record, add `SplitTestUserGetter.getProjection(splitTestName)` to the projection.
 *
 * @param {SplitTestUser} user an already-fetched mongo user
 * @param splitTestName the unique name of the split test
 * @param options {Object<sync: boolean>} - for test purposes only, to force the synchronous update of the user's profile
 * @returns {Promise<Assignment>}
 */
async function getAssignmentForMongoUser(
  user,
  splitTestName,
  { sync = false } = {}
) {
  const { userId, analyticsId } = _getIdsFromMongoUser(user) // throw outside the try/catch.
  try {
    if (!Features.hasFeature('saas')) {
      return _getNonSaasAssignment(splitTestName)
    }
    return _getAssignment(splitTestName, { analyticsId, userId, user, sync })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get split test assignment for user')
    return DEFAULT_ASSIGNMENT
  }
}

/**
 * Returns true if user has already been explicitly assigned to a variant.
 * This will be false if the user **would** be assigned when calling getAssignment but hasn't yet.
 *
 * @param req express request
 * @param {string} userId the user ID
 * @param {string} splitTestName the unique name of the split test
 * @param {string} variant variant name to check
 * @param {boolean} ignoreVersion users explicitly assigned to a previous version should be treated as if assigned to latest version
 */
async function hasUserBeenAssignedToVariant(
  req,
  userId,
  splitTestName,
  variant,
  ignoreVersion = false
) {
  try {
    const { session = {}, query = {} } = req

    const splitTest = await _getSplitTest(splitTestName)
    const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)

    if (!userId || !currentVersion?.active) {
      return false
    }

    // Check the query string for an override, ignoring an invalid value
    const queryVariant = query[splitTestName]
    if (queryVariant === variant) {
      const variants = await _getVariantNames(splitTestName)
      if (variants.includes(queryVariant)) {
        return true
      }
    }

    // Allow dev toolbar and session cache to override assignment from DB
    if (Settings.devToolbar.enabled) {
      const override = session?.splitTestOverrides?.[splitTestName]
      if (override === variant) {
        return true
      }
    }

    const canUseSessionCache = session && SessionManager.isUserLoggedIn(session)
    if (canUseSessionCache) {
      const cachedVariant = SplitTestSessionHandler.getCachedVariant(
        session,
        splitTestName,
        currentVersion
      )
      if (cachedVariant === variant) {
        return true
      }
    }

    // get variant from db, including explicit assignments from previous versions if requested
    const assignments = await getActiveAssignmentsForUser(
      userId,
      true,
      ignoreVersion
    )
    const testAssignment = assignments[splitTestName]

    if (!testAssignment || !testAssignment.assignedAt) {
      return false
    }

    // if variant matches and we can use cache, we should persist it in cache
    if (testAssignment.variantName === variant && testAssignment.assignedAt) {
      if (canUseSessionCache) {
        SplitTestSessionHandler.setVariantInCache({
          session,
          splitTestName,
          currentVersion,
          selectedVariantName: variant,
          activeForUser: true,
        })
      }
      return true
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to get split test assignment for user')
    return false
  }
}

/**
 * Get a mapping of the active split test assignments for the given user
 */
async function getActiveAssignmentsForUser(
  userId,
  removeArchived = false,
  ignoreVersion = false
) {
  if (!Features.hasFeature('saas')) {
    return {}
  }

  const user = await SplitTestUserGetter.promises.getUser(
    userId,
    null,
    'getActiveAssignmentsForUser'
  )
  if (user == null) {
    return {}
  }

  return getActiveAssignmentsForMongoUser(user, removeArchived, ignoreVersion)
}

/**
 * Get a mapping of the active split test assignments from an already-fetched mongo user, avoiding a re-fetch. This should be the full user record.
 * @param {SplitTestUser} user
 * @param {boolean} removeArchived
 * @param {boolean} ignoreVersion
 */
async function getActiveAssignmentsForMongoUser(
  user,
  removeArchived = false,
  ignoreVersion = false
) {
  if (!Features.hasFeature('saas')) {
    return {}
  }

  const { analyticsId } = _getIdsFromMongoUser(user) // throw early.

  const splitTests = (await SplitTestCache.get('')).values()
  const assignments = {}
  for (const splitTest of splitTests) {
    if (!splitTest.versions[splitTest.versions.length - 1].active) continue
    if (removeArchived && splitTest.archived) continue
    const { activeForUser, selectedVariantName, phase, versionNumber } =
      await _getAssignmentMetadata(analyticsId, user, splitTest)
    if (activeForUser) {
      const assignment = {
        variantName: selectedVariantName,
        versionNumber,
        phase,
      }
      const userAssignments = user.splitTests?.[splitTest.name]
      if (Array.isArray(userAssignments)) {
        let userAssignment
        if (!ignoreVersion) {
          userAssignment = userAssignments.find(
            x => x.versionNumber === versionNumber
          )
        } else {
          userAssignment = userAssignments[0]
        }
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
 * Performs a one-time assignment that is not recorded nor reproducible.
 * To be used only in cases where we need random assignments that are independent of a user or session.
 * If the test is in alpha or beta phase, always returns the default variant.
 * @param splitTestName
 * @returns {Promise<Assignment>}
 */
async function getOneTimeAssignment(splitTestName) {
  try {
    if (!Features.hasFeature('saas')) {
      return _getNonSaasAssignment(splitTestName)
    }

    const splitTest = await _getSplitTest(splitTestName)
    if (!splitTest) {
      return DEFAULT_ASSIGNMENT
    }
    const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)

    if (currentVersion.phase !== RELEASE_PHASE) {
      return DEFAULT_ASSIGNMENT
    }

    const randomUUID = crypto.randomUUID()
    const { selectedVariantName } = await _getAssignmentMetadata(
      randomUUID,
      undefined,
      splitTest
    )
    return _makeAssignment({
      variant: selectedVariantName,
      currentVersion,
      isFirstNonDefaultAssignment:
        selectedVariantName !== DEFAULT_VARIANT && _isSplitTest(splitTest),
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get one time split test assignment')
    return DEFAULT_ASSIGNMENT
  }
}

/**
 * Checks if a feature flag is enabled for a specific user
 *
 * Retrieves the feature flag assignment for a user and determines if the assigned variant is 'enabled'
 *
 * @param req the request
 * @param res the Express response object
 * @param {string} splitTestName - The unique name of the feature flag
 * @param {Object} options
 * @param {boolean} options.includeReferer For ajax requests and downloads include the split test overrides of the page
 * @returns {Promise<boolean>} True if the user's assigned variant is 'enabled', false otherwise
 */
async function featureFlagEnabled(
  req,
  res,
  splitTestName,
  { includeReferer = false } = { includeReferer: false }
) {
  const { variant } = await getAssignment(req, res, splitTestName, {
    includeReferer,
  })
  return variant === 'enabled'
}

/**
 * Checks if a feature flag is enabled for a specific user
 *
 * Retrieves the feature flag assignment for a user and determines if the assigned variant is 'enabled'
 *
 * @param {string} userId - The ID of the user to check the feature flag for
 * @param {string} splitTestName - The unique name of the feature flag
 * @returns {Promise<boolean>} True if the user's assigned variant is 'enabled', false otherwise
 */
async function featureFlagEnabledForUser(userId, splitTestName) {
  const { variant } = await getAssignmentForUser(userId, splitTestName)
  return variant === 'enabled'
}

/**
 * Checks if a feature flag is enabled from an already-fetched mongo user
 *
 * See getAssignmentForMongoUser for details on the user.
 *
 * @param {SplitTestUser} user an already-fetched mongo user
 * @param {string} splitTestName - The unique name of the feature flag
 * @returns {Promise<boolean>} True if the user's assigned variant is 'enabled', false otherwise
 */
async function featureFlagEnabledForMongoUser(user, splitTestName) {
  const { variant } = await getAssignmentForMongoUser(user, splitTestName)
  return variant === 'enabled'
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

/**
 * Extract the ids needed for a split test assignment from an already-fetched
 * mongo user, throwing if a required field is missing from the projection.
 *
 * Only the ids are validated: the program/`splitTests` fields are read with
 * optional chaining and a missing value is a legitimate "not enrolled" state.
 *
 * @param {SplitTestUser} user
 * @return {{userId: string, analyticsId: string}}
 */
function _getIdsFromMongoUser(user) {
  const userId = user?._id?.toString()
  if (!userId) {
    throw new Error('bug: include db.users._id in projection')
  }
  const analyticsId = user?.analyticsId
  if (!analyticsId) {
    throw new Error('bug: include db.users.analyticsId in projection')
  }
  return { userId, analyticsId }
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

  if (Settings.devToolbar.enabled) {
    const override = session?.splitTestOverrides?.[splitTestName]
    if (override) {
      return _makeAssignment({ variant: override, currentVersion })
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
    const cachedVariant = SplitTestSessionHandler.getCachedVariant(
      session,
      splitTest.name,
      currentVersion
    )

    if (cachedVariant) {
      Metrics.inc('split_test_get_assignment_source', 1, { status: 'cache' })
      if (
        cachedVariant ===
        SplitTestSessionHandler.CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER
      ) {
        return DEFAULT_ASSIGNMENT
      } else {
        return _makeAssignment({
          variant: cachedVariant,
          currentVersion,
          isFirstNonDefaultAssignment: false,
        })
      }
    }
  }

  if (user) {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'provided' })
  } else if (userId) {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'mongo' })
  } else {
    Metrics.inc('split_test_get_assignment_source', 1, { status: 'none' })
  }

  user =
    user ||
    (userId &&
      (await SplitTestUserGetter.promises.getUser(
        userId,
        splitTestName,
        `_getAssignment:${splitTestName}`
      )))
  const metadata = await _getAssignmentMetadata(analyticsId, user, splitTest)
  const { activeForUser, selectedVariantName, phase, versionNumber } = metadata

  if (canUseSessionCache) {
    SplitTestSessionHandler.setVariantInCache({
      session,
      splitTestName,
      currentVersion,
      selectedVariantName,
      activeForUser,
    })
  }

  if (activeForUser) {
    const hasUserLimit = _currentVersionHasUserLimit(splitTest)

    if (_isSplitTest(splitTest) || hasUserLimit) {
      // if the user is logged in, persist the assignment (and increment user count if needed)
      if (userId) {
        const assignmentData = {
          user,
          userId,
          splitTestName,
          phase,
          versionNumber,
          variantName: selectedVariantName,
        }
        if (sync === true) {
          await _recordAssignment(assignmentData)
        } else {
          _recordAssignment(assignmentData).catch(err => {
            logger.warn(
              {
                err,
                userId,
                splitTestName,
                phase,
                versionNumber,
                variantName: selectedVariantName,
              },
              'failed to record split test assignment'
            )
          })
        }
      }
      // otherwise this is an anonymous user, we store assignments in session to persist them on registration
      else if (_isSplitTest(splitTest)) {
        await SplitTestSessionHandler.promises.appendAssignment(session, {
          splitTestId: splitTest._id,
          splitTestName,
          phase,
          versionNumber,
          variantName: selectedVariantName,
          assignedAt: new Date(),
        })
      }

      if (_isSplitTest(splitTest)) {
        const effectiveAnalyticsId = user?.analyticsId || analyticsId || userId
        AnalyticsManager.setUserPropertyForAnalyticsId(
          effectiveAnalyticsId,
          `split-test-${splitTestName}-${versionNumber}`,
          selectedVariantName
        ).catch(err => {
          logger.warn(
            {
              err,
              analyticsId: effectiveAnalyticsId,
              splitTest: splitTestName,
              versionNumber,
              variant: selectedVariantName,
            },
            'failed to set user property for analytics id'
          )
        })
      }
    }
    let isFirstNonDefaultAssignment
    if (userId) {
      isFirstNonDefaultAssignment = metadata.isFirstNonDefaultAssignment
    } else {
      const assignments =
        await SplitTestSessionHandler.promises.getAssignments(session)
      isFirstNonDefaultAssignment = !assignments?.[splitTestName]
    }

    return _makeAssignment({
      variant: selectedVariantName,
      currentVersion,
      isFirstNonDefaultAssignment,
    })
  }

  return DEFAULT_ASSIGNMENT
}

async function _getAssignmentMetadata(analyticsId, user, splitTest) {
  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  const versionNumber = currentVersion.versionNumber
  const phase = currentVersion.phase

  // For continuity on phase rollout for gradual rollouts, we keep all users from the previous phase enrolled to the variant.
  // In beta, all alpha and labs users are cohorted to the variant, and the same in release phase all alpha, labs & beta users.
  if (
    _isGradualRollout(splitTest) &&
    ((phase === BETA_PHASE && user?.alphaProgram) ||
      (phase === RELEASE_PHASE &&
        (user?.alphaProgram ||
          user?.betaProgram ||
          (user?.labsProgram &&
            user?.labsExperiments?.includes(splitTest.name)))))
  ) {
    return {
      activeForUser: true,
      selectedVariantName: currentVersion.variants[0].name,
      phase,
      versionNumber,
      isFirstNonDefaultAssignment: false,
    }
  }

  // Labs phase: user must be in labs program AND have opted into this experiment.
  // The userCount/userLimit check is enforced at enrollment time (see
  // incrementLabsVariantCounterIfBelowLimit), so we trust the enrollment here.
  if (phase === LABS_PHASE) {
    if (user?.labsProgram && user?.labsExperiments?.includes(splitTest.name)) {
      const selectedVariant = currentVersion.variants[0]
      const selectedVariantName = selectedVariant.name

      return {
        activeForUser: true,
        selectedVariantName,
        phase,
        versionNumber,
        isFirstNonDefaultAssignment: false,
      }
    }
    return {
      activeForUser: false,
    }
  }

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
  let selectedVariantName =
    _getVariantFromPercentile(currentVersion.variants, percentile) ||
    DEFAULT_VARIANT

  // Some variants may have a limit on the number of users that can be assigned
  if (selectedVariantName !== DEFAULT_VARIANT) {
    const selectedVariant = currentVersion.variants.find(
      variant => variant.name === selectedVariantName
    )
    const userLimit = selectedVariant?.userLimit

    if (userLimit && typeof userLimit === 'number') {
      const userAssignments = user?.splitTests?.[splitTest.name]
      const existingAssignment = Array.isArray(userAssignments)
        ? userAssignments.find(
            assignment =>
              assignment.phase === phase &&
              assignment.variantName === selectedVariantName
          )
        : null

      if (!existingAssignment) {
        const currentCount = selectedVariant.userCount ?? 0

        if (currentCount >= userLimit) {
          selectedVariantName = DEFAULT_VARIANT
        }
      }
    }
  }
  return {
    activeForUser: true,
    selectedVariantName,
    phase,
    versionNumber,
    isFirstNonDefaultAssignment:
      selectedVariantName !== DEFAULT_VARIANT &&
      _isSplitTest(splitTest) &&
      (!Array.isArray(user?.splitTests?.[splitTest.name]) ||
        !user?.splitTests?.[splitTest.name]?.some(
          assignment => assignment.variantName !== DEFAULT_VARIANT
        )),
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
  if (!Settings.devToolbar.enabled) {
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

async function _recordAssignment({
  user,
  userId,
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
  user =
    user ||
    (await SplitTestUserGetter.promises.getUser(
      userId,
      splitTestName,
      `_recordAssignment:${splitTestName}`
    ))
  if (user) {
    const assignedSplitTests = user.splitTests || []
    const assignmentLog = assignedSplitTests[splitTestName] || []
    const existingAssignment = _.find(assignmentLog, { versionNumber })
    if (!existingAssignment) {
      const shouldIncrementCounter = await _shouldIncrementVariantCounter(
        splitTestName,
        variantName,
        phase,
        user
      )

      const updatePromises = [
        UserUpdater.promises.updateUser(userId, {
          $addToSet: {
            [`splitTests.${splitTestName}`]: persistedAssignment,
          },
        }),
      ]

      if (shouldIncrementCounter) {
        updatePromises.push(
          _incrementVariantCounter(splitTestName, variantName, versionNumber)
        )
      }

      await Promise.all(updatePromises)
    }
  }
}

/**
 * Check if the variant counter should be incremented for this assignment
 * Only increment for tests with user limits and when user hasn't been assigned to this variant in this phase before
 * @param {string} splitTestName - The name of the split test
 * @param {string} variantName - The name of the variant
 * @param {string} phase - The phase of the split test
 * @param {SplitTestUser} user - The user object
 * @returns {Promise<boolean>} Whether the counter should be incremented
 */
async function _shouldIncrementVariantCounter(
  splitTestName,
  variantName,
  phase,
  user
) {
  if (variantName === DEFAULT_VARIANT) {
    return false
  }

  // Labs variant counters are managed at enrollment/unenrollment time,
  // not at assignment time.
  if (phase === LABS_PHASE) {
    return false
  }

  const splitTest = await _getSplitTest(splitTestName)
  if (!splitTest) {
    return false
  }

  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (!currentVersion) {
    return false
  }

  const variant = currentVersion.variants.find(v => v.name === variantName)
  const hasUserLimit =
    variant?.userLimit && typeof variant.userLimit === 'number'

  if (!hasUserLimit) {
    return false
  }

  const userAssignments = user?.splitTests?.[splitTest.name]
  const existingPhaseAssignment = Array.isArray(userAssignments)
    ? userAssignments.find(
        assignment =>
          assignment.phase === phase && assignment.variantName === variantName
      )
    : null

  // Only increment if user hasn't been assigned to this variant in this phase before
  return !existingPhaseAssignment
}

function _makeAssignment({
  variant,
  currentVersion,
  isFirstNonDefaultAssignment,
}) {
  return {
    variant,
    metadata: {
      phase: currentVersion.phase,
      versionNumber: currentVersion.versionNumber,
      isFirstNonDefaultAssignment,
    },
  }
}

async function _loadSplitTestInfoInLocals(locals, splitTestName, session) {
  const splitTest = await _getSplitTest(splitTestName)
  if (splitTest) {
    const override = session?.splitTestOverrides?.[splitTestName]

    const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
    if (!currentVersion.active && !Settings.devToolbar.enabled) {
      return
    }

    const phase = currentVersion.phase
    const info = {
      phase,
      badgeInfo: splitTest.badgeInfo?.[phase],
    }

    if (phase === 'labs') {
      const variant = currentVersion.variants?.[0]
      info.labsDetails = {
        title: splitTest.labsTitle || '',
        description: splitTest.labsDescription || '',
        icon: splitTest.labsIcon || '',
        surveyLink: splitTest.badgeInfo?.labs?.url || '',
        successNotification: {
          content: splitTest.labsSuccessNotification?.content || '',
          buttonLabel: splitTest.labsSuccessNotification?.buttonLabel || '',
          buttonUrl: splitTest.labsSuccessNotification?.buttonUrl || '',
        },
        isFull: SplitTestUtils.isExperimentFull(variant),
        versionCreatedAt:
          currentVersion.createdAt instanceof Date
            ? currentVersion.createdAt.toISOString()
            : currentVersion.createdAt,
      }
    }

    if (Settings.devToolbar.enabled) {
      info.active = currentVersion.active
      info.variants = currentVersion.variants.map(variant => ({
        name: variant.name,
        rolloutPercent: variant.rolloutPercent,
      }))
      info.hasOverride = !!override
    }
    LocalsHelper.setSplitTestInfo(locals, splitTestName, info)
  } else if (Settings.devToolbar.enabled) {
    LocalsHelper.setSplitTestInfo(locals, splitTestName, {
      missing: true,
    })
  }
}

function _getNonSaasAssignment(splitTestName) {
  if (Settings.splitTestOverrides?.[splitTestName]) {
    return {
      variant: Settings.splitTestOverrides?.[splitTestName],
      metadata: {},
    }
  }
  return DEFAULT_ASSIGNMENT
}

async function _getSplitTest(name) {
  const splitTests = await SplitTestCache.get('')
  const splitTest = splitTests?.get(name)
  if (splitTest && !splitTest.archived) {
    return splitTest
  }
}

function _isSplitTest(featureFlag) {
  return SplitTestUtils.getCurrentVersion(featureFlag).analyticsEnabled
}

function _isGradualRollout(featureFlag) {
  return !SplitTestUtils.getCurrentVersion(featureFlag).analyticsEnabled
}

function _currentVersionHasUserLimit(featureFlag) {
  const currentVersion = SplitTestUtils.getCurrentVersion(featureFlag)
  return currentVersion.variants.some(
    v => v.userLimit && typeof v.userLimit === 'number'
  )
}

/**
 * Increment the user counter for a specific variant
 * @param {string} splitTestName - The name of the split test
 * @param {string} variantName - The name of the variant
 * @param {number} versionNumber - The version to update
 */
async function _incrementVariantCounter(
  splitTestName,
  variantName,
  versionNumber
) {
  try {
    await SplitTest.updateOne(
      {
        name: splitTestName,
        'versions.versionNumber': versionNumber,
        'versions.variants.name': variantName,
      },
      {
        $inc: {
          'versions.$.variants.$[variant].userCount': 1,
        },
      },
      {
        arrayFilters: [{ 'variant.name': variantName }],
      }
    ).exec()
  } catch (error) {
    logger.error(
      { err: error, splitTestName, variantName, versionNumber },
      'Failed to increment variant counter'
    )
  }
}

/**
 * Atomically increment the labs variant counter only if below the user limit.
 * Returns true if a slot was claimed, false if the limit has been reached.
 * When there is no userLimit, enrollment is always allowed (returns true).
 * @param {string} splitTestName
 * @returns {Promise<boolean>}
 */
async function incrementLabsVariantCounterIfBelowLimit(splitTestName) {
  const splitTest = await _getSplitTest(splitTestName)
  if (!splitTest) return false

  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (!currentVersion || currentVersion.phase !== LABS_PHASE) return false

  const variant = currentVersion.variants[0]
  if (!variant) return false

  if (!variant.userLimit || typeof variant.userLimit !== 'number') {
    return true
  }

  const result = await SplitTest.updateOne(
    {
      name: splitTestName,
      'versions.versionNumber': currentVersion.versionNumber,
    },
    {
      $inc: {
        'versions.$.variants.$[variant].userCount': 1,
      },
    },
    {
      arrayFilters: [
        {
          'variant.name': variant.name,
          'variant.userCount': { $not: { $gte: variant.userLimit } },
        },
      ],
    }
  ).exec()

  return result.modifiedCount > 0
}

/**
 * Decrement the user counter for a labs experiment when a user opts out.
 * This frees up a slot so another user can enroll.
 * @param {string} splitTestName
 */
async function decrementLabsVariantCounter(splitTestName) {
  const splitTest = await _getSplitTest(splitTestName)
  if (!splitTest) return

  const currentVersion = SplitTestUtils.getCurrentVersion(splitTest)
  if (!currentVersion || currentVersion.phase !== LABS_PHASE) return

  const variant = currentVersion.variants[0]
  if (!variant?.userLimit || typeof variant.userLimit !== 'number') return
  if (!variant.userCount || variant.userCount <= 0) return

  try {
    const result = await SplitTest.updateOne(
      {
        name: splitTestName,
        'versions.versionNumber': currentVersion.versionNumber,
        'versions.variants.name': variant.name,
      },
      {
        $inc: {
          'versions.$.variants.$[variant].userCount': -1,
        },
      },
      {
        arrayFilters: [{ 'variant.name': variant.name }],
      }
    ).exec()
    if (result.modifiedCount === 0) {
      logger.warn(
        { splitTestName },
        'Labs variant counter decrement matched no documents'
      )
    }
  } catch (error) {
    logger.error(
      { err: error, splitTestName },
      'Failed to decrement labs variant counter'
    )
  }
}

async function userMaintenanceOnLogin(user) {
  const splitTests = (await SplitTestCache.get('')).values()
  const toCleanup = {}
  for (const splitTest of splitTests) {
    if (splitTest.archived && user.splitTests?.[splitTest.name]) {
      toCleanup[`splitTests.${splitTest.name}`] = 1
    }
  }
  if (Object.keys(toCleanup).length > 0) {
    await UserUpdater.promises.updateUser(user._id, {
      $unset: toCleanup,
    })
  }
}

export default {
  getPercentile,
  getAssignment: callbackify(getAssignment),
  getAssignmentForUser: callbackify(getAssignmentForUser),
  getAssignmentForMongoUser: callbackify(getAssignmentForMongoUser),
  featureFlagEnabled: callbackify(featureFlagEnabled),
  featureFlagEnabledForUser: callbackify(featureFlagEnabledForUser),
  featureFlagEnabledForMongoUser: callbackify(featureFlagEnabledForMongoUser),
  getOneTimeAssignment: callbackify(getOneTimeAssignment),
  getActiveAssignmentsForUser: callbackify(getActiveAssignmentsForUser),
  getActiveAssignmentsForMongoUser: callbackify(
    getActiveAssignmentsForMongoUser
  ),
  hasUserBeenAssignedToVariant: callbackify(hasUserBeenAssignedToVariant),
  setOverrideInSession,
  clearOverridesInSession,
  promises: {
    getAssignment,
    getAssignmentForUser,
    getAssignmentForMongoUser,
    featureFlagEnabled,
    featureFlagEnabledForUser,
    featureFlagEnabledForMongoUser,
    getOneTimeAssignment,
    getActiveAssignmentsForUser,
    getActiveAssignmentsForMongoUser,
    hasUserBeenAssignedToVariant,
    decrementLabsVariantCounter,
    incrementLabsVariantCounterIfBelowLimit,
    userMaintenanceOnLogin,
  },
}
