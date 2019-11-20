const settings = require('settings-sharelatex')
const Metrics = require('metrics-sharelatex')
const RedisWrapper = require('./RedisWrapper')
const rclient = RedisWrapper.client('ratelimiter')
const RollingRateLimiter = require('rolling-rate-limiter')
const { promisifyAll } = require('../util/promises')

const RateLimiter = {
  addCount(opts, callback) {
    if (settings.disableRateLimits) {
      return callback(null, true)
    }
    if (callback == null) {
      callback = function() {}
    }
    const namespace = `RateLimit:${opts.endpointName}:`
    const k = `{${opts.subjectName}}`
    const limiter = RollingRateLimiter({
      redis: rclient,
      namespace,
      interval: opts.timeInterval * 1000,
      maxInInterval: opts.throttle
    })
    limiter(k, function(err, timeLeft, actionsLeft) {
      if (err) {
        return callback(err)
      }
      const allowed = timeLeft === 0
      if (!allowed) {
        Metrics.inc(`rate-limit-hit.${opts.endpointName}`, 1, {
          path: opts.endpointName
        })
      }
      return callback(null, allowed)
    })
  },

  clearRateLimit(endpointName, subject, callback) {
    // same as the key which will be built by RollingRateLimiter (namespace+k)
    const keyName = `RateLimit:${endpointName}:{${subject}}`
    rclient.del(keyName, callback)
  }
}

RateLimiter.promises = promisifyAll(RateLimiter)
module.exports = RateLimiter
