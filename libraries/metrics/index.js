const ExpressCompression = require('compression')
const prom = require('./prom_wrapper')

const { collectDefaultMetrics } = prom

let appname = 'unknown'
const hostname = require('os').hostname()

const destructors = []

require('./uv_threadpool_size')

function initialize(_name, opts = {}) {
  appname = _name
  collectDefaultMetrics({ timeout: 5000, prefix: buildPromKey() })
  if (opts.ttlInMinutes) {
    prom.ttlInMinutes = opts.ttlInMinutes
  }

  console.log(`ENABLE_TRACE_AGENT set to ${process.env.ENABLE_TRACE_AGENT}`)
  if (process.env.ENABLE_TRACE_AGENT === 'true') {
    console.log('starting google trace agent')
    const traceAgent = require('@google-cloud/trace-agent')

    const traceOpts = { ignoreUrls: [/^\/status/, /^\/health_check/] }
    traceAgent.start(traceOpts)
  }

  console.log(`ENABLE_DEBUG_AGENT set to ${process.env.ENABLE_DEBUG_AGENT}`)
  if (process.env.ENABLE_DEBUG_AGENT === 'true') {
    console.log('starting google debug agent')
    const debugAgent = require('@google-cloud/debug-agent')
    debugAgent.start({
      allowExpressions: true,
      serviceContext: {
        service: appname,
        version: process.env.BUILD_VERSION
      }
    })
  }

  console.log(`ENABLE_PROFILE_AGENT set to ${process.env.ENABLE_PROFILE_AGENT}`)
  if (process.env.ENABLE_PROFILE_AGENT === 'true') {
    console.log('starting google profile agent')
    const profiler = require('@google-cloud/profiler')
    profiler.start({
      serviceContext: {
        service: appname,
        version: process.env.BUILD_VERSION
      }
    })
  }

  inc('process_startup')
}

function registerDestructor(func) {
  destructors.push(func)
}

function injectMetricsRoute(app) {
  app.get(
    '/metrics',
    ExpressCompression({
      level: parseInt(process.env.METRICS_COMPRESSION_LEVEL || '1', 10)
    }),
    function(req, res) {
      res.set('Content-Type', prom.registry.contentType)
      res.end(prom.registry.metrics())
    }
  )
}

function buildPromKey(key = '') {
  return key.replace(/[^a-zA-Z0-9]/g, '_')
}

function sanitizeValue(value) {
  return parseFloat(value)
}

function set(key, value, sampleRate = 1) {
  console.log('counts are not currently supported')
}

function inc(key, sampleRate = 1, opts = {}) {
  key = buildPromKey(key)
  opts.app = appname
  opts.host = hostname
  prom.metric('counter', key).inc(opts)
  if (process.env.DEBUG_METRICS) {
    console.log('doing inc', key, opts)
  }
}

function count(key, count, sampleRate = 1, opts = {}) {
  key = buildPromKey(key)
  opts.app = appname
  opts.host = hostname
  prom.metric('counter', key).inc(opts, count)
  if (process.env.DEBUG_METRICS) {
    console.log('doing count/inc', key, opts)
  }
}

function summary(key, value, opts = {}) {
  key = buildPromKey(key)
  opts.app = appname
  opts.host = hostname
  prom.metric('summary', key).observe(opts, value)
  if (process.env.DEBUG_METRICS) {
    console.log('doing summary', key, value, opts)
  }
}

function timing(key, timeSpan, sampleRate, opts = {}) {
  key = buildPromKey('timer_' + key)
  opts.app = appname
  opts.host = hostname
  prom.metric('summary', key).observe(opts, timeSpan)
  if (process.env.DEBUG_METRICS) {
    console.log('doing timing', key, opts)
  }
}

class Timer {
  constructor(key, sampleRate = 1, opts = {}) {
    this.start = new Date()
    key = buildPromKey(key)
    this.key = key
    this.sampleRate = sampleRate
    this.opts = opts
  }

  done() {
    const timeSpan = new Date() - this.start
    timing(this.key, timeSpan, this.sampleRate, this.opts)
    return timeSpan
  }
}

function gauge(key, value, sampleRate = 1, opts = {}) {
  key = buildPromKey(key)
  prom.metric('gauge', key).set(
    {
      app: appname,
      host: hostname,
      status: opts.status
    },
    this.sanitizeValue(value)
  )
  if (process.env.DEBUG_METRICS) {
    console.log('doing gauge', key, opts)
  }
}

function globalGauge(key, value, sampleRate = 1, opts = {}) {
  key = buildPromKey(key)
  prom
    .metric('gauge', key)
    .set({ app: appname, status: opts.status }, this.sanitizeValue(value))
}

function close() {
  for (const func of destructors) {
    func()
  }
}

module.exports = {
  initialize,
  registerDestructor,
  injectMetricsRoute,
  buildPromKey,
  sanitizeValue,
  set,
  inc,
  count,
  summary,
  timing,
  Timer,
  gauge,
  globalGauge,
  close,

  register: prom.registry,

  mongodb: require('./mongodb'),
  http: require('./http'),
  open_sockets: require('./open_sockets'),
  event_loop: require('./event_loop'),
  memory: require('./memory'),
  timeAsyncMethod: require('./timeAsyncMethod')
}
