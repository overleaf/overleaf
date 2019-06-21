const logger = require('logger-sharelatex')
const request = require('requestretry')

const isProduction =
  (process.env['NODE_ENV'] || '').toLowerCase() === 'production'
const isTest = process.env['MOCHA_GREP'] !== undefined

const BACKOFF_MAX_TRIES = 3
const BACKOFF_BASE = 500
const BACKOFF_MULTIPLIER = 1.5
const BACKOFF_RANDOM_FACTOR = 0.5

//
// Use an exponential backoff to retry requests
//
// This is based on what the Google HTTP client does:
// https://developers.google.com/api-client-library/java/google-http-java-client/reference/1.20.0/com/google/api/client/util/ExponentialBackOff
//
let FaultTolerantRequest
module.exports = FaultTolerantRequest = {
  request: function(options, callback) {
    options = Object.assign(
      {
        maxAttempts: BACKOFF_MAX_TRIES,
        backoffBase: BACKOFF_BASE,
        backoffMultiplier: BACKOFF_MULTIPLIER,
        backoffRandomFactor: BACKOFF_RANDOM_FACTOR
      },
      options
    )

    options.delayStrategy = FaultTolerantRequest.exponentialDelayStrategy(
      options.backoffBase,
      options.backoffMultiplier,
      options.backoffRandomFactor
    )

    request(options, callback)
  },

  backgroundRequest: function(options, callback) {
    FaultTolerantRequest.request(options, function(err) {
      if (err) {
        return logger.err(
          { err, url: options.url, query: options.qs, body: options.body },
          'Background request failed'
        )
      }
    })

    callback() // Do not wait for all the attempts
  },

  exponentialDelayStrategy: function(
    backoffBase,
    backoffMultiplier,
    backoffRandomFactor
  ) {
    let backoff = backoffBase

    return function() {
      const delay = exponentialDelay(backoff, backoffRandomFactor)
      backoff *= backoffMultiplier
      return delay
    }
  }
}

function exponentialDelay(backoff, backoffRandomFactor) {
  // set delay to `backoff` initially
  let delay = backoff

  // adds randomness
  delay *= 1 - backoffRandomFactor + 2 * Math.random() * backoffRandomFactor

  // round value as it's already in milliseconds
  delay = Math.round(delay)

  // log retries in production
  if (isProduction && !isTest) {
    logger.warn(`Background request failed. Will try again in ${delay}ms`)
  }

  return delay
}
