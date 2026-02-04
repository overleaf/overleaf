import SessionManager from '../Authentication/SessionManager.mjs'
import UserAnalyticsIdCache from './UserAnalyticsIdCache.mjs'
import Settings from '@overleaf/settings'
import Metrics from '../../infrastructure/Metrics.mjs'
import Queues from '../../infrastructure/Queues.mjs'
import crypto, { createHash } from 'node:crypto'
import _ from 'lodash'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'

if (
  Settings.analytics?.enabled &&
  process.env.NODE_ENV !== 'test' &&
  !Settings.analytics?.hashedEmailSalt
) {
  // This isn't important enough to crash the app, but we want to record the error
  logger.error({}, 'Settings.analytics.hashedEmailSalt should be set')
}

const analyticsEventsQueue = Queues.getQueue('analytics-events')
const analyticsEditingSessionsQueue = Queues.getQueue(
  'analytics-editing-sessions'
)
const analyticsUserPropertiesQueue = Queues.getQueue(
  'analytics-user-properties'
)
const analyticsAccountMappingQueue = Queues.getQueue(
  'analytics-account-mapping'
)
const analyticsEmailChangeQueue = Queues.getQueue('analytics-email-change')
const analyticsPackageUsageQueue = Queues.getQueue('analytics-package-usage')

const ONE_MINUTE_MS = 60 * 1000

const UUID_REGEXP = /^[\w]{8}(-[\w]{4}){3}-[\w]{12}$/

function identifyUser(userId, analyticsId, isNewUser) {
  if (!userId || !analyticsId || !analyticsId.toString().match(UUID_REGEXP)) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }
  Metrics.analyticsQueue.inc({ status: 'adding', event_type: 'identify' })
  Queues.createScheduledJob(
    'analytics-events',
    {
      name: 'identify',
      data: { userId, analyticsId, isNewUser, createdAt: new Date() },
    },
    ONE_MINUTE_MS
  )
    .then(() => {
      Metrics.analyticsQueue.inc({ status: 'added', event_type: 'identify' })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({ status: 'error', event_type: 'identify' })
    })
}

async function recordEventForUser(userId, event, segmentation) {
  if (!userId) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }
  const analyticsId = await UserAnalyticsIdCache.get(userId)
  if (analyticsId) {
    _recordEvent({ analyticsId, userId, event, segmentation, isLoggedIn: true })
  }
}

function recordEventForUserInBackground(userId, event, segmentation) {
  recordEventForUser(userId, event, segmentation).catch(err => {
    logger.warn(
      { err, userId, event, segmentation },
      'failed to record event for user'
    )
  })
}

function recordEventForSession(session, event, segmentation) {
  const { analyticsId, userId } = getIdsFromSession(session)
  if (!analyticsId) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }
  _recordEvent({
    analyticsId,
    userId,
    event,
    segmentation,
    isLoggedIn: !!userId,
    createdAt: new Date(),
  })
}

function emitPackageUsage(projectId, { documentClasses, packages }) {
  analyticsPackageUsageQueue
    .add('package-usage', { projectId, documentClasses, packages })
    .catch(err => {
      logger.warn({ err, projectId }, 'Failed to emit package usage')
    })
}

async function setUserPropertyForUser(userId, propertyName, propertyValue) {
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }

  _checkPropertyValue(propertyValue)

  const analyticsId = await UserAnalyticsIdCache.get(userId)
  if (analyticsId) {
    await _setUserProperty({ analyticsId, propertyName, propertyValue })
  }
}

function setUserPropertyForUserInBackground(userId, property, value) {
  setUserPropertyForUser(userId, property, value).catch(err => {
    logger.warn(
      { err, userId, property, value },
      'failed to set user property for user'
    )
  })
}

async function setUserPropertyForAnalyticsId(
  analyticsId,
  propertyName,
  propertyValue
) {
  if (_isAnalyticsDisabled()) {
    return
  }

  _checkPropertyValue(propertyValue)

  await _setUserProperty({ analyticsId, propertyName, propertyValue })
}

async function setUserPropertyForSession(session, propertyName, propertyValue) {
  const { analyticsId, userId } = getIdsFromSession(session)
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }

  _checkPropertyValue(propertyValue)

  if (analyticsId) {
    await _setUserProperty({ analyticsId, propertyName, propertyValue })
  }
}

function setUserPropertyForSessionInBackground(session, property, value) {
  setUserPropertyForSession(session, property, value).catch(err => {
    const { analyticsId, userId } = getIdsFromSession(session)
    logger.warn(
      { err, analyticsId, userId, property, value },
      'failed to set user property for session'
    )
  })
}

/**
 * @typedef {(import('./types').AccountMapping)} AccountMapping
 * @typedef {(import('./types').EmailChangePayload)} EmailChangePayload
 */

/**
 * Register mapping between two accounts.
 *
 * @param {AccountMapping} payload - The event payload to send to Analytics
 */
function registerAccountMapping({
  source,
  sourceEntity,
  sourceEntityId,
  target,
  targetEntity,
  targetEntityId,
  createdAt,
}) {
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'account-mapping',
  })

  analyticsAccountMappingQueue
    .add('account-mapping', {
      source,
      sourceEntity,
      sourceEntityId,
      target,
      targetEntity,
      targetEntityId,
      createdAt: createdAt ?? new Date(),
    })
    .then(() => {
      Metrics.analyticsQueue.inc({
        status: 'added',
        event_type: 'account-mapping',
      })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({
        status: 'error',
        event_type: 'account-mapping',
      })
    })
}

/**
 * Registers operations relating to email addresses.
 *
 * Generally, this should be called through the EmailChangeHelper module to ensure
 * that the right data is sent.
 *
 * This will be called whenever an email is created, updated or deleted.
 *
 * @param {EmailChangePayload} payload
 */
function registerEmailChange({
  userId,
  email,
  action,
  createdAt = new Date(),
  emailCreatedAt,
  isPrimary,
  emailConfirmedAt,
  emailDeletedAt,
}) {
  Metrics.analyticsQueue.inc({ status: 'adding', event_type: 'email-change' })

  const hashedEmail = createHash('sha256')
    .update(`${email}${Settings.analytics?.hashedEmailSalt}`)
    .digest('hex')

  analyticsEmailChangeQueue
    .add('email-change', {
      action,
      createdAt,
      emailDeletedAt,
      email: hashedEmail,
      emailConfirmedAt,
      emailCreatedAt,
      isPrimary,
      userId,
    })
    .then(() => {
      Metrics.analyticsQueue.inc({
        status: 'added',
        event_type: 'email-change',
      })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({
        status: 'error',
        event_type: 'email-change',
      })
    })
}

function updateEditingSession(userId, projectId, countryCode, segmentation) {
  if (!userId) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }
  if (!_isSegmentationValid(segmentation)) {
    logger.info(
      { userId, projectId, segmentation },
      'rejecting analytics editing session due to bad segmentation'
    )
    return
  }
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'editing-session',
  })
  analyticsEditingSessionsQueue
    .add('editing-session', {
      userId,
      projectId,
      countryCode,
      segmentation,
      createdAt: new Date(),
    })
    .then(() => {
      Metrics.analyticsQueue.inc({
        status: 'added',
        event_type: 'editing-session',
      })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({
        status: 'error',
        event_type: 'editing-session',
      })
    })
}

function _recordEvent(
  { analyticsId, userId, event, segmentation, isLoggedIn },
  { delay } = {}
) {
  if (!_isAttributeValid(event)) {
    logger.info(
      { analyticsId, event, segmentation },
      'rejecting analytics event due to bad event name'
    )
    return
  }
  if (!_isSegmentationValid(segmentation)) {
    logger.info(
      { analyticsId, event, segmentation },
      'rejecting analytics event due to bad segmentation'
    )
    return
  }
  logger.debug(
    {
      analyticsId,
      userId,
      event,
      segmentation,
      isLoggedIn: !!userId,
      createdAt: new Date(),
    },
    'queueing analytics event'
  )
  Metrics.analyticsQueue.inc({ status: 'adding', event_type: 'event' })
  analyticsEventsQueue
    .add(
      'event',
      {
        analyticsId,
        userId,
        event,
        segmentation,
        isLoggedIn,
        createdAt: new Date(),
      },
      { delay }
    )
    .then(() => {
      Metrics.analyticsQueue.inc({ status: 'added', event_type: 'event' })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({ status: 'error', event_type: 'event' })
    })
}

async function _setUserProperty({ analyticsId, propertyName, propertyValue }) {
  if (!_isAttributeValid(propertyName)) {
    logger.info(
      { analyticsId, propertyName, propertyValue },
      'rejecting analytics user property due to bad name'
    )
    return
  }
  if (!_isAttributeValueValid(propertyValue)) {
    logger.info(
      { analyticsId, propertyName, propertyValue },
      'rejecting analytics user property due to bad value'
    )
    return
  }
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'user-property',
  })
  await analyticsUserPropertiesQueue
    .add('user-property', {
      analyticsId,
      propertyName,
      propertyValue,
      createdAt: new Date(),
    })
    .then(() => {
      Metrics.analyticsQueue.inc({
        status: 'added',
        event_type: 'user-property',
      })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({
        status: 'error',
        event_type: 'user-property',
      })
    })
}

function _isSmokeTestUser(userId) {
  const smokeTestUserId = Settings.smokeTest && Settings.smokeTest.userId
  return (
    smokeTestUserId != null &&
    userId != null &&
    userId.toString() === smokeTestUserId
  )
}

function _isAnalyticsDisabled() {
  return !(Settings.analytics && Settings.analytics.enabled)
}

function _checkPropertyValue(propertyValue) {
  if (propertyValue === undefined) {
    throw new Error(
      'propertyValue cannot be undefined, use null to unset a property'
    )
  }
}

function _isAttributeValid(attribute) {
  return !attribute || /^[a-zA-Z0-9-_.:;,/]+$/.test(attribute)
}

function _isAttributeValueValid(attributeValue) {
  return _isAttributeValid(attributeValue) || attributeValue instanceof Date
}

function _isSegmentationValid(segmentation) {
  if (segmentation) {
    for (const key of Object.keys(segmentation)) {
      if (!_isAttributeValid(key)) {
        return false
      }
    }
  }

  return true
}

function getIdsFromSession(session) {
  const analyticsId = _.get(session, ['analyticsId'])
  const userId = SessionManager.getLoggedInUserId(session)
  return { analyticsId, userId }
}

async function analyticsIdMiddleware(req, res, next) {
  const session = req.session
  const sessionUser = SessionManager.getSessionUser(session)

  if (sessionUser) {
    session.analyticsId = await UserAnalyticsIdCache.get(sessionUser._id)
  } else if (!session.analyticsId) {
    // generate an `analyticsId` if needed
    session.analyticsId = crypto.randomUUID()
  }

  res.locals.getSessionAnalyticsId = () => session.analyticsId

  next()
}

export default {
  identifyUser,
  recordEventForSession,
  recordEventForUser,
  recordEventForUserInBackground,
  emitPackageUsage,
  setUserPropertyForUser,
  setUserPropertyForUserInBackground,
  setUserPropertyForSession,
  setUserPropertyForSessionInBackground,
  setUserPropertyForAnalyticsId,
  updateEditingSession,
  getIdsFromSession,
  registerAccountMapping,
  registerEmailChange,
  analyticsIdMiddleware: expressify(analyticsIdMiddleware),
}
