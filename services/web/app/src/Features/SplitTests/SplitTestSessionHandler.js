const { callbackify } = require('util')
const _ = require('lodash')
const { ObjectId } = require('mongodb-legacy')
const logger = require('@overleaf/logger')
const Metrics = require('@overleaf/metrics')
const SessionManager = require('../Authentication/SessionManager')
const SplitTestCache = require('./SplitTestCache')
const SplitTestUtils = require('./SplitTestUtils')
const SplitTestUserGetter = require('./SplitTestUserGetter')

const CACHE_TOMBSTONE_SPLIT_TEST_NOT_ACTIVE_FOR_USER = null
const TOKEN_SEP = ';'
// this is safe to use as a separator adjacent to a base64 string because Mongo object IDs
// do not generate any padding when converted (24 hex digits = 12 bytes => multiple of 6),
// thus do not contain any trailing `=`
const KEY_VALUE_SEP = '='
const ID_VERSION_SEP = '_'
const VARIANT_DATE_SEP = ':'

async function getAssignments(session) {
  await _convertAnonymousAssignmentsIfNeeded(session)

  if (!session.sta) {
    return undefined
  }

  const assignments = {}
  const tokens = session.sta.split(TOKEN_SEP)
  const splitTests = Array.from((await SplitTestCache.get('')).values())
  for (const token of tokens) {
    try {
      if (!token.length) {
        continue
      }
      const [splitTestNameVersion, info] = token.split(KEY_VALUE_SEP)
      const [splitTestId64, versionStr] =
        splitTestNameVersion.split(ID_VERSION_SEP)

      const splitTest = splitTests.find(
        test => splitTestId64 === _convertIdToBase64(test._id)
      )
      if (!splitTest) {
        continue
      }

      const splitTestName = splitTest.name
      const versionNumber = parseInt(versionStr)
      const [variantChar, timestampStr36] = info.split(VARIANT_DATE_SEP)
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
      if (
        !_.find(assignments[splitTestName], {
          versionNumber,
          variantName,
        })
      )
        assignments[splitTestName].push({
          versionNumber,
          variantName,
          phase: 'release', // anonymous users can only be exposed to tests in release phase
          assignedAt,
        })
    } catch (error) {
      logger.error(
        { err: error, token },
        'Failed to resolve cached anonymous split test assignments from session'
      )
    }
  }

  return assignments
}

async function appendAssignment(session, assignment) {
  await _convertAnonymousAssignmentsIfNeeded(session)

  if (
    !_hasExistingAssignment(
      session,
      assignment.splitTestId,
      assignment.versionNumber
    )
  ) {
    if (!session.sta) {
      session.sta = ''
    }
    const splitTests = await SplitTestCache.get('')
    const splitTest = splitTests.get(assignment.splitTestName)
    const assignmentString = _buildAssignmentString(splitTest, assignment)
    const separator = session.sta.length > 0 ? TOKEN_SEP : ''
    session.sta += `${separator}${assignmentString}`
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
  if (session.sta) {
    Metrics.summary(
      'split_test_session_storage_count',
      (session.sta || '').split(';').length
    )
    Metrics.summary(
      'split_test_session_storage_size',
      (session.sta || '').length
    )
  }
}

async function _convertAnonymousAssignmentsIfNeeded(session) {
  if (session.splitTests) {
    const splitTests = await SplitTestCache.get('')
    if (!session.sta) {
      session.sta = ''
    }
    for (const [splitTestName, assignments] of Object.entries(
      session.splitTests || {}
    )) {
      const splitTest = splitTests.get(splitTestName)
      for (const assignment of assignments) {
        const assignmentString = _buildAssignmentString(splitTest, assignment)
        const separator = session.sta.length > 0 ? TOKEN_SEP : ''
        if (!session.sta.includes(assignmentString)) {
          session.sta += `${separator}${assignmentString}`
        }
      }
    }
    delete session.splitTests
  }
}

function _hasExistingAssignment(session, splitTest, versionNumber) {
  if (!session.sta) {
    return false
  }
  const index = session.sta.indexOf(
    `${_convertIdToBase64(splitTest._id)}${ID_VERSION_SEP}${versionNumber}=`
  )
  return index >= 0
}

function _buildAssignmentString(splitTest, assignment) {
  const { versionNumber, variantName, assignedAt } = assignment
  const variants = SplitTestUtils.getCurrentVersion(splitTest).variants
  const splitTestId = _convertIdToBase64(splitTest._id)
  const variantChar =
    variantName === 'default'
      ? 'd'
      : _.findIndex(variants, { name: variantName })
  const timestamp = Math.floor(new Date(assignedAt).getTime() / 1000).toString(
    36
  )
  return `${splitTestId}${ID_VERSION_SEP}${versionNumber}${KEY_VALUE_SEP}${variantChar}${VARIANT_DATE_SEP}${timestamp}`
}

function _convertIdToBase64(id) {
  return new ObjectId(id).toString('base64')
}

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
