const Settings = require('settings-sharelatex')
const Metrics = require('../../infrastructure/Metrics')
const Queues = require('../../infrastructure/Queues')

const analyticsEventsQueue = Queues.getAnalyticsEventsQueue()
const analyticsEditingSessionsQueue = Queues.getAnalyticsEditingSessionsQueue()
const analyticsUserPropertiesQueue = Queues.getAnalyticsUserPropertiesQueue()

function identifyUser(userId, oldUserId) {
  if (!userId || !oldUserId) {
    return
  }
  if (isAnalyticsDisabled() || isSmokeTestUser(userId)) {
    return
  }
  Metrics.analyticsQueue.inc({ status: 'adding', event_type: 'identify' })
  analyticsEventsQueue
    .add('identify', { userId, oldUserId })
    .then(() => {
      Metrics.analyticsQueue.inc({ status: 'added', event_type: 'identify' })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({ status: 'error', event_type: 'identify' })
    })
}

function recordEvent(userId, event, segmentation) {
  if (!userId) {
    return
  }
  if (isAnalyticsDisabled() || isSmokeTestUser(userId)) {
    return
  }
  Metrics.analyticsQueue.inc({ status: 'adding', event_type: 'event' })
  analyticsEventsQueue
    .add('event', { userId, event, segmentation })
    .then(() => {
      Metrics.analyticsQueue.inc({ status: 'added', event_type: 'event' })
    })
    .catch(() => {
      Metrics.analyticsQueue.inc({ status: 'error', event_type: 'event' })
    })
}

function updateEditingSession(userId, projectId, countryCode) {
  if (!userId) {
    return
  }
  if (isAnalyticsDisabled() || isSmokeTestUser(userId)) {
    return
  }
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'editing-session',
  })
  analyticsEditingSessionsQueue
    .add({ userId, projectId, countryCode })
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

function setUserProperty(userId, propertyName, propertyValue) {
  if (!userId) {
    return
  }
  if (isAnalyticsDisabled() || isSmokeTestUser(userId)) {
    return
  }
  Metrics.analyticsQueue.inc({
    status: 'adding',
    event_type: 'user-property',
  })
  analyticsUserPropertiesQueue
    .add({ userId, propertyName, propertyValue })
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

function isSmokeTestUser(userId) {
  const smokeTestUserId = Settings.smokeTest && Settings.smokeTest.userId
  return smokeTestUserId != null && userId.toString() === smokeTestUserId
}

function isAnalyticsDisabled() {
  return !(Settings.analytics && Settings.analytics.enabled)
}

module.exports = {
  identifyUser,
  recordEvent,
  updateEditingSession,
  setUserProperty,
}
