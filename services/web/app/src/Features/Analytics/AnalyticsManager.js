const SessionManager = require('../Authentication/SessionManager')
const UserAnalyticsIdCache = require('./UserAnalyticsIdCache')
const Settings = require('@overleaf/settings')
const Metrics = require('../../infrastructure/Metrics')
const Queues = require('../../infrastructure/Queues')
const uuid = require('uuid')
const _ = require('lodash')
const { expressify } = require('../../util/promises')
const { logger } = require('@overleaf/logger')

const analyticsEventsQueue = Queues.getQueue('analytics-events')
const analyticsEditingSessionsQueue = Queues.getQueue(
  'analytics-editing-sessions'
)
const analyticsUserPropertiesQueue = Queues.getQueue(
  'analytics-user-properties'
)

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

function recordEventForSession(session, event, segmentation) {
  const { analyticsId, userId } = getIdsFromSession(session)
  if (!analyticsId) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }
  logger.info({
    analyticsId,
    userId,
    event,
    segmentation,
    isLoggedIn: !!userId,
    createdAt: new Date(),
  })
  _recordEvent({
    analyticsId,
    userId,
    event,
    segmentation,
    isLoggedIn: !!userId,
    createdAt: new Date(),
  })
}

async function setUserPropertyForUser(userId, propertyName, propertyValue) {
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }

  _checkPropertyValue(propertyValue)

  const analyticsId = await UserAnalyticsIdCache.get(userId)
  if (analyticsId) {
    _setUserProperty({ analyticsId, propertyName, propertyValue })
  }
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

  _setUserProperty({ analyticsId, propertyName, propertyValue })
}

async function setUserPropertyForSession(session, propertyName, propertyValue) {
  const { analyticsId, userId } = getIdsFromSession(session)
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
    return
  }

  _checkPropertyValue(propertyValue)

  if (analyticsId) {
    _setUserProperty({ analyticsId, propertyName, propertyValue })
  }
}

function updateEditingSession(userId, projectId, countryCode, segmentation) {
  if (!userId) {
    return
  }
  if (_isAnalyticsDisabled() || _isSmokeTestUser(userId)) {
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

function _setUserProperty({ analyticsId, propertyName, propertyValue }) {
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'user-property',
  })
  analyticsUserPropertiesQueue
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

function getIdsFromSession(session) {
  const analyticsId = _.get(session, ['analyticsId'])
  const userId = SessionManager.getLoggedInUserId(session)
  return { analyticsId, userId }
}

async function analyticsIdMiddleware(req, res, next) {
  const session = req.session
  const sessionUser = SessionManager.getSessionUser(session)

  if (sessionUser) {
    // ensure `session.analyticsId` is set to the user's `analyticsId`, and fallback to their `userId` for pre-analyticsId users
    session.analyticsId = sessionUser.analyticsId || sessionUser._id
  } else if (!session.analyticsId) {
    // generate an `analyticsId` if needed
    session.analyticsId = uuid.v4()
  }

  next()
}

module.exports = {
  identifyUser,
  recordEventForSession,
  recordEventForUser,
  setUserPropertyForUser,
  setUserPropertyForSession,
  setUserPropertyForAnalyticsId,
  updateEditingSession,
  getIdsFromSession,
  analyticsIdMiddleware: expressify(analyticsIdMiddleware),
}
