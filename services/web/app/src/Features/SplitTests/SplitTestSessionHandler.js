const { callbackify } = require('util')
const _ = require('lodash')
const { ObjectId } = require('mongodb')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const SessionManager = require('../Authentication/SessionManager')
const SplitTestCache = require('./SplitTestCache')
const SplitTestUtils = require('./SplitTestUtils')
const SplitTestUserGetter = require('./SplitTestUserGetter')

const CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER = null

async function getAssignments(session) {
  if (!session.splitTests && !session.sta) {
    return undefined
  }

  // await _convertAnonymousAssignmentsIfNeeded(session)
  const assignments = _.clone(session.splitTests || {})
  if (session.sta) {
    const tokens = session.sta.split(';')
    const splitTests = Array.from((await SplitTestCache.get('')).values())
    for (const token of tokens) {
      try {
        if (!token.length) {
          continue
        }
        const [splitTestNameVersion, info] = token.split('=')
        const [splitTestId64, versionStr] = splitTestNameVersion.split('_')

        const splitTest = splitTests.find(
          test =>
            test._id.toString() ===
            new ObjectId(Buffer.from(splitTestId64, 'base64')).toString()
        )
        if (!splitTest) {
          continue
        }

        const splitTestName = splitTest.name
        const versionNumber = parseInt(versionStr)
        const [variantChar, timestampStr36] = info.split(':')
        const assignedAt = new Date(parseInt(timestampStr36, 36) * 1000)
        let variantName
        if (variantChar === 'd') {
          variantName = 'default'
        } else {
          const variantIndex = parseInt(variantChar)
          variantName =
            SplitTestUtils.getCurrentVersion(splitTest).variants[variantIndex]
              .name
        }

        if (!assignments[splitTestName]) {
          assignments[splitTestName] = []
        }
        assignments[splitTestName].push({
          versionNumber,
          variantName,
          phase: 'release', // anonymous users can only be exposed to tests in release phase
          assignedAt,
        })
      } catch (error) {
        logger.error(
          { err: error, token },
          'Failed to resolve anonymous split test assignment from session'
        )
      }
    }
  }

  return assignments
}

async function appendAssignment(session, assignment) {
  // await _convertAnonymousAssignmentsIfNeeded(session)

  if (!session.splitTests) {
    session.splitTests = {}
  }
  if (!session.splitTests[assignment.splitTestName]) {
    session.splitTests[assignment.splitTestName] = []
  }

  const assignments = await getAssignments(session)
  if (
    !_.find(assignments[assignment.splitTestName], {
      variantName: assignment.variantName,
      versionNumber: assignment.versionNumber,
    })
  ) {
    // if (!session.sta) {
    //   session.sta = ''
    // }
    // const splitTests = await SplitTestCache.get('')
    // const splitTest = splitTests.get(assignment.splitTestName)
    // const assignmentString = _buildAssignmentString(splitTest, assignment)
    // const separator = session.sta.length > 0 ? ';' : ''
    // session.sta += `${separator}${assignmentString}`
    session.splitTests[assignment.splitTestName].push({
      variantName: assignment.variantName,
      versionNumber: assignment.versionNumber,
      phase: assignment.phase,
      assignedAt: assignment.assignedAt,
    })
  }
}

function getCachedVariant(session, splitTestName, currentVersion) {
  if (!session.cachedSplitTestAssignments) {
    session.cachedSplitTestAssignments = {}
  }
  const cacheKey = `${splitTestName}-${currentVersion.versionNumber}`
  return session.cachedSplitTestAssignments[cacheKey]
}

function setVariantInCache({
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
    user = user || (await SplitTestUserGetter.promises.getUser(sessionUser._id))
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

function collectSessionStats(session) {
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
      (session.sta || '').split(';').length +
        Object.keys(session.splitTests).length
    )
    Metrics.summary(
      'split_test_session_storage_size',
      (session.sta || '').length + JSON.stringify(session.splitTests).length
    )
  }
}

// async function _convertAnonymousAssignmentsIfNeeded(session) {
//   if (typeof session.splitTests === 'object') {
//     const sessionAssignments = session.splitTests
//     const splitTests = await SplitTestCache.get('')
//     session.splitTests = ''
//     for (const [splitTestName, assignments] of Object.entries(
//       sessionAssignments
//     )) {
//       const splitTest = splitTests.get(splitTestName)
//       for (const assignment of assignments) {
//         const assignmentString = _buildAssignmentString(splitTest, assignment)
//         const separator = session.splitTests.length > 0 ? ';' : ''
//         session.splitTests += `${separator}${assignmentString}`
//       }
//     }
//   }
// }

// function _hasExistingAssignment(session, splitTest, versionNumber) {
//   if (!session.sta) {
//     return false
//   }
//   const index = session.sta.indexOf(
//     `${_convertIdToBase64(splitTest._id)}_${versionNumber}=`
//   )
//   return index >= 0
// }

// function _buildAssignmentString(splitTest, assignment) {
//   const { versionNumber, variantName, assignedAt } = assignment
//   const variants = SplitTestUtils.getCurrentVersion(splitTest).variants
//   const splitTestId = _convertIdToBase64(splitTest._id)
//   const variantChar =
//     variantName === 'default'
//       ? 'd'
//       : _.findIndex(variants, { name: variantName })
//   const timestamp = Math.floor(assignedAt.getTime() / 1000).toString(36)
//   return `${splitTestId}_${versionNumber}=${variantChar}:${timestamp}`
// }

// function _convertIdToBase64(id) {
//   return new ObjectId(id).toString('base64')
// }

module.exports = {
  getAssignments: callbackify(getAssignments),
  appendAssignment: callbackify(appendAssignment),
  getCachedVariant,
  setVariantInCache,
  sessionMaintenance: callbackify(sessionMaintenance),
  collectSessionStats,
  CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER,
  promises: {
    getAssignments,
    appendAssignment,
    sessionMaintenance,
  },
}
