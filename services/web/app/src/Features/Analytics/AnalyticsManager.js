const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const request = require('request')
const FaultTolerantRequest = require('../../infrastructure/FaultTolerantRequest')
const Errors = require('../Errors/Errors')

// check that the request should be made: ignore smoke test user and ensure the
// analytics service is configured
const checkAnalyticsRequest = function(userId) {
  if (
    settings.smokeTest &&
    settings.smokeTest.userId &&
    settings.smokeTest.userId.toString() === userId.toString()
  ) {
    // ignore smoke test user
    return { error: null, skip: true }
  }

  if (!settings.apis.analytics) {
    return {
      error: new Errors.ServiceNotConfiguredError(
        'Analytics service not configured'
      ),
      skip: true
    }
  }

  return { error: null, skip: false }
}

// prepare the request: set `fromv2` param and full URL
const prepareAnalyticsRequest = function(options) {
  if (settings.overleaf != null) {
    options.qs = Object.assign({}, options.qs, { fromV2: 1 })
  }

  const urlPath = options.url
  options.url = `${settings.apis.analytics.url}${urlPath}`

  options.timeout = options.timeout || 30000

  return options
}

// make the request to analytics after checking and preparing it.
// request happens asynchronously in the background and will be retried on error
const makeAnalyticsBackgroundRequest = function(userId, options, callback) {
  let { error, skip } = checkAnalyticsRequest(userId)
  if (error || skip) {
    return callback(error)
  }
  prepareAnalyticsRequest(options)

  // With the tweaked parameter values (BACKOFF_BASE=3000, BACKOFF_MULTIPLIER=3):
  // - the 6th attempt (maxAttempts=6) will run after 5.5 to 11.5 minutes
  // - the 9th attempt (maxAttempts=9) will run after 86 to 250 minutes
  options.maxAttempts = options.maxAttempts || 9
  options.backoffBase = options.backoffBase || 3000
  options.backoffMultiplier = options.backoffMultiplier || 3

  FaultTolerantRequest.backgroundRequest(options, callback)
}

// make synchronous request to analytics without retries after checking and
// preparing it.
const makeAnalyticsRequest = function(userId, options, callback) {
  let { error, skip } = checkAnalyticsRequest(userId)
  if (error || skip) {
    return callback(error)
  }
  prepareAnalyticsRequest(options)

  request(options, callback)
}

module.exports = {
  identifyUser(userId, oldUserId, callback) {
    if (!callback) {
      // callback is optional
      callback = () => {}
    }

    const opts = {
      body: {
        old_user_id: oldUserId
      },
      json: true,
      method: 'POST',
      url: `/user/${userId}/identify`
    }
    makeAnalyticsBackgroundRequest(userId, opts, callback)
  },

  recordEvent(userId, event, segmentation, callback) {
    if (segmentation == null) {
      // segmentation is optional
      segmentation = {}
    }
    if (!callback) {
      // callback is optional
      callback = () => {}
    }

    const opts = {
      body: {
        event,
        segmentation
      },
      json: true,
      method: 'POST',
      url: `/user/${userId}/event`
    }

    makeAnalyticsBackgroundRequest(userId, opts, callback)
  },

  updateEditingSession(userId, projectId, countryCode, callback) {
    if (!callback) {
      // callback is optional
      callback = () => {}
    }

    const query = {
      userId,
      projectId
    }

    if (countryCode) {
      query.countryCode = countryCode
    }

    const opts = {
      method: 'PUT',
      url: '/editingSession',
      qs: query,
      maxAttempts: 6 // dont retry for too long as session ping timestamp are
      // recorded when the request is received on the analytics
    }

    makeAnalyticsBackgroundRequest(userId, opts, callback)
  },

  getLastOccurrence(userId, event, callback) {
    const opts = {
      body: {
        event
      },
      json: true,
      method: 'POST',
      timeout: 1000,
      url: `/user/${userId}/event/last_occurrence`
    }
    makeAnalyticsRequest(userId, opts, function(err, response, body) {
      if (err != null) {
        console.log(response, opts)
        logger.warn({ userId, err }, 'error getting last occurance of event')
        callback(err)
      } else {
        callback(null, body)
      }
    })
  }
}
