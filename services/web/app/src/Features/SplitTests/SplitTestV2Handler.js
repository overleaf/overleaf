const UserGetter = require('../User/UserGetter')
const UserUpdater = require('../User/UserUpdater')
const AnalyticsManager = require('../Analytics/AnalyticsManager')
const crypto = require('crypto')
const _ = require('lodash')
const { callbackify } = require('util')
const splitTestCache = require('./SplitTestCache')

const DEFAULT_VARIANT = 'default'
const ALPHA_PHASE = 'alpha'
const BETA_PHASE = 'beta'

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
 * AnalyticsManager.recordEvent(userId, 'example-project-created', {
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
  const splitTest = await splitTestCache.get(splitTestName)

  if (splitTest) {
    const currentVersion = splitTest.getCurrentVersion()
    if (currentVersion.active) {
      const {
        activeForUser,
        selectedVariantName,
        phase,
        versionNumber,
      } = await _getAssignmentMetadata(userId, splitTest)
      if (activeForUser) {
        const assignmentConfig = {
          userId,
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
  return {
    variant: DEFAULT_VARIANT,
    analytics: {
      segmentation: {},
    },
  }
}

async function _getAssignmentMetadata(userId, splitTest) {
  const currentVersion = splitTest.getCurrentVersion()
  const phase = currentVersion.phase
  if ([ALPHA_PHASE, BETA_PHASE].includes(phase)) {
    const user = await _getUser(userId)
    if (
      (phase === ALPHA_PHASE && !(user && user.alphaProgram)) ||
      (phase === BETA_PHASE && !(user && user.betaProgram))
    ) {
      return {
        activeForUser: false,
      }
    }
  }
  const percentile = _getPercentile(userId, splitTest.name, phase)
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

function _getPercentile(userId, splitTestName, splitTestPhase) {
  const hash = crypto
    .createHash('md5')
    .update(userId + splitTestName + splitTestPhase)
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
  splitTestName,
  phase,
  versionNumber,
  variantName,
}) {
  const user = await _getUser(userId)
  if (user) {
    const assignedSplitTests = user.splitTests || []
    const assignmentLog = assignedSplitTests[splitTestName] || []
    const existingAssignment = _.find(assignmentLog, { versionNumber })
    if (!existingAssignment) {
      await UserUpdater.promises.updateUser(userId, {
        $addToSet: {
          [`splitTests.${splitTestName}`]: {
            variantName,
            versionNumber,
            phase,
            assignedAt: new Date(),
          },
        },
      })
      AnalyticsManager.setUserProperty(
        userId,
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
  promises: {
    getAssignment,
  },
}
