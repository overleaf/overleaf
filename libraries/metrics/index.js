/* eslint-disable no-console */

const ExpressCompression = require('compression')
const promClient = require('prom-client')
const promWrapper = require('./prom_wrapper')

const destructors = []

require('./uv_threadpool_size')

function registerDestructor(func) {
  destructors.push(func)
}

function injectMetricsRoute(app) {
  app.get(
    '/metrics',
    ExpressCompression({
      level: parseInt(process.env.METRICS_COMPRESSION_LEVEL || '1', 10),
    }),
    function (req, res, next) {
      res.set('Content-Type', promWrapper.registry.contentType)
      promWrapper.registry
        .metrics()
        .then(metrics => {
          res.end(metrics)
        })
        .catch(err => {
          next(err)
        })
    }
  )
}

function buildPromKey(key) {
  return key.replace(/[^a-zA-Z0-9]/g, '_')
}

function sanitizeValue(value) {
  return parseFloat(value)
}

function set(key, value, sampleRate = 1) {
  console.log('counts are not currently supported')
}

function inc(key, sampleRate = 1, labels = {}) {
  if (arguments.length === 2 && typeof sampleRate === 'object') {
    labels = sampleRate
  }

  key = buildPromKey(key)
  promWrapper.metric('counter', key, labels).inc(labels)
  if (process.env.DEBUG_METRICS) {
    console.log('doing inc', key, labels)
  }
}

function count(key, count, sampleRate = 1, labels = {}) {
  if (arguments.length === 3 && typeof sampleRate === 'object') {
    labels = sampleRate
  }

  key = buildPromKey(key)
  promWrapper.metric('counter', key, labels).inc(labels, count)
  if (process.env.DEBUG_METRICS) {
    console.log('doing count/inc', key, labels)
  }
}

function summary(key, value, labels = {}) {
  key = buildPromKey(key)
  promWrapper.metric('summary', key, labels).observe(labels, value)
  if (process.env.DEBUG_METRICS) {
    console.log('doing summary', key, value, labels)
  }
}

function timing(key, timeSpan, sampleRate = 1, labels = {}) {
  if (arguments.length === 3 && typeof sampleRate === 'object') {
    labels = sampleRate
  }

  key = buildPromKey('timer_' + key)
  promWrapper.metric('summary', key, labels).observe(labels, timeSpan)
  if (process.env.DEBUG_METRICS) {
    console.log('doing timing', key, labels)
  }
}

function histogram(key, value, buckets, labels = {}) {
  key = buildPromKey('histogram_' + key)
  promWrapper.metric('histogram', key, labels, buckets).observe(labels, value)
  if (process.env.DEBUG_METRICS) {
    console.log('doing histogram', key, buckets, labels)
  }
}

class Timer {
  /**
   * @param {string} key
   * @param {number} sampleRate
   * @param {Record<string, any>} labels
   * @param {Array<number>} buckets
   */
  constructor(key, sampleRate = 1, labels = {}, buckets = undefined) {
    if (typeof sampleRate === 'object') {
      // called with (key, labels, buckets)
      if (arguments.length === 3) {
        buckets = labels
        labels = sampleRate
      }

      // called with (key, labels)
      if (arguments.length === 2) {
        labels = sampleRate
      }

      sampleRate = 1 // default value to pass to timing function
    }

    this.start = new Date()
    key = buildPromKey(key)
    this.key = key
    this.sampleRate = sampleRate
    this.labels = labels
    this.buckets = buckets
  }

  // any labels passed into the done method override labels from constructor
  done(labels = {}) {
    const timeSpan = new Date() - this.start
    if (this.buckets) {
      histogram(this.key, timeSpan, this.buckets, { ...this.labels, ...labels })
    } else {
      timing(this.key, timeSpan, this.sampleRate, { ...this.labels, ...labels })
    }
    return timeSpan
  }
}

function gauge(key, value, sampleRate = 1, labels = {}) {
  if (arguments.length === 3 && typeof sampleRate === 'object') {
    labels = sampleRate
  }

  key = buildPromKey(key)
  promWrapper.metric('gauge', key, labels).set(labels, sanitizeValue(value))
  if (process.env.DEBUG_METRICS) {
    console.log('doing gauge', key, labels)
  }
}

function globalGauge(key, value, sampleRate = 1, labels = {}) {
  key = buildPromKey(key)
  labels = { host: 'global', ...labels }
  promWrapper.metric('gauge', key, labels).set(labels, sanitizeValue(value))
}

function close() {
  for (const func of destructors) {
    func()
  }
}

module.exports.registerDestructor = registerDestructor
module.exports.injectMetricsRoute = injectMetricsRoute
module.exports.buildPromKey = buildPromKey
module.exports.sanitizeValue = sanitizeValue
module.exports.set = set
module.exports.inc = inc
module.exports.count = count
module.exports.summary = summary
module.exports.timing = timing
module.exports.histogram = histogram
module.exports.Timer = Timer
module.exports.gauge = gauge
module.exports.globalGauge = globalGauge
module.exports.close = close
module.exports.prom = promClient
module.exports.register = promWrapper.registry

module.exports.http = require('./http')
module.exports.open_sockets = require('./open_sockets')
module.exports.leaked_sockets = require('./leaked_sockets')
module.exports.event_loop = require('./event_loop')
module.exports.memory = require('./memory')
module.exports.mongodb = require('./mongodb')
