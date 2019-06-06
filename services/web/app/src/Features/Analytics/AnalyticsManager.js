/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')
const _ = require('underscore')
const request = require('requestretry')
const Errors = require('../Errors/Errors')

const isProduction =
  (process.env['NODE_ENV'] || '').toLowerCase() === 'production'
const isTest = process.env['MOCHA_GREP'] !== undefined

const makeFaultTolerantRequest = function(userId, options, callback) {
  if (
    userId + '' ===
    (settings.smokeTest != null ? settings.smokeTest.userId : undefined) + ''
  ) {
    return callback()
  }

  options = Object.assign(options, {
    delayStrategy: exponentialBackoffStrategy(),
    timeout: 30000
  })

  if (settings.overleaf != null) {
    options.qs = Object.assign({}, options.qs, { fromV2: 1 })
  }

  makeRequest(options, function(err) {
    if (err != null) {
      return logger.err({ err }, 'Request to analytics failed')
    }
  })

  return callback() // Do not wait for all the attempts
}

var makeRequest = function(opts, callback) {
  if (
    __guard__(
      settings.apis != null ? settings.apis.analytics : undefined,
      x => x.url
    ) != null
  ) {
    const urlPath = opts.url
    opts.url = `${settings.apis.analytics.url}${urlPath}`
    return request(opts, callback)
  } else {
    return callback(
      new Errors.ServiceNotConfiguredError('Analytics service not configured')
    )
  }
}

// Set an exponential backoff to retry calls to analytics. First retry will
// happen after 4s, then 8, 16, 32, 64...
var exponentialBackoffStrategy = function() {
  let attempts = 1 // This won't be called until there has been 1 failure

  return function() {
    attempts += 1
    return exponentialBackoffDelay(attempts)
  }
}

var exponentialBackoffDelay = function(attempts) {
  const delay = Math.pow(2, attempts) * 1000

  if (isProduction && !isTest) {
    logger.warn(
      'Error comunicating with the analytics service. ' +
        `Will try again attempt ${attempts} in ${delay}ms`
    )
  }

  return delay
}

module.exports = {
  identifyUser(user_id, old_user_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const opts = {
      body: {
        old_user_id
      },
      json: true,
      method: 'POST',
      timeout: 1000,
      url: `/user/${user_id}/identify`
    }
    return makeRequest(opts, callback)
  },

  recordEvent(user_id, event, segmentation, callback) {
    if (segmentation == null) {
      segmentation = {}
    }
    if (callback == null) {
      callback = function(error) {}
    }
    const opts = {
      body: {
        event,
        segmentation
      },
      json: true,
      method: 'POST',
      url: `/user/${user_id}/event`,
      maxAttempts: 7 // Give up after ~ 8min
    }

    return makeFaultTolerantRequest(user_id, opts, callback)
  },

  updateEditingSession(userId, projectId, countryCode, callback) {
    if (callback == null) {
      callback = function(error) {}
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
      maxAttempts: 6 // Give up after ~ 4min
    }

    return makeFaultTolerantRequest(userId, opts, callback)
  },

  getLastOccurrence(user_id, event, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const opts = {
      body: {
        event
      },
      json: true,
      method: 'POST',
      timeout: 1000,
      url: `/user/${user_id}/event/last_occurrence`
    }
    return makeRequest(opts, function(err, response, body) {
      if (err != null) {
        console.log(response, opts)
        logger.err({ user_id, err }, 'error getting last occurance of event')
        return callback(err)
      } else {
        return callback(null, body)
      }
    })
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}
