/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const prom = require('prom-client')
const registry = require('prom-client').register
const metrics = new Map()

const optsKey = function (opts) {
  let keys = Object.keys(opts)
  if (keys.length === 0) {
    return ''
  }

  keys = keys.sort()

  let hash = ''
  for (const key of Array.from(keys)) {
    if (hash.length) {
      hash += ','
    }
    hash += `${key}:${opts[key]}`
  }

  return hash
}

const extendOpts = function (opts, labelNames) {
  // Make a clone in order to be able to re-use opts for other kinds of metrics.
  opts = Object.assign({}, opts)
  for (const label of Array.from(labelNames)) {
    if (!opts[label]) {
      opts[label] = ''
    }
  }
  return opts
}

const optsAsArgs = function (opts, labelNames) {
  const args = []
  for (const label of Array.from(labelNames)) {
    args.push(opts[label] || '')
  }
  return args
}

const PromWrapper = {
  ttlInMinutes: 0,
  registry,

  metric(type, name, buckets) {
    return metrics.get(name) || new MetricWrapper(type, name, buckets)
  },

  collectDefaultMetrics: prom.collectDefaultMetrics,
}

class MetricWrapper {
  constructor(type, name, buckets) {
    metrics.set(name, this)
    this.name = name
    this.instances = new Map()
    this.lastAccess = new Date()
    this.metric = (() => {
      switch (type) {
        case 'counter':
          return new prom.Counter({
            name,
            help: name,
            labelNames: ['status', 'method', 'path'],
          })
        case 'histogram':
          return new prom.Histogram({
            name,
            help: name,
            labelNames: [
              'path',
              'status_code',
              'method',
              'collection',
              'query',
            ],
            buckets,
          })
        case 'summary':
          return new prom.Summary({
            name,
            help: name,
            maxAgeSeconds: 60,
            ageBuckets: 10,
            labelNames: [
              'path',
              'status_code',
              'method',
              'collection',
              'query',
            ],
          })
        case 'gauge':
          return new prom.Gauge({
            name,
            help: name,
            labelNames: ['host', 'status'],
          })
      }
    })()
  }

  inc(opts, value) {
    return this._execMethod('inc', opts, value)
  }

  observe(opts, value) {
    return this._execMethod('observe', opts, value)
  }

  set(opts, value) {
    return this._execMethod('set', opts, value)
  }

  sweep() {
    const thresh = new Date(Date.now() - 1000 * 60 * PromWrapper.ttlInMinutes)
    this.instances.forEach((instance, key) => {
      if (thresh > instance.time) {
        if (process.env.DEBUG_METRICS) {
          // eslint-disable-next-line no-console
          console.log(
            'Sweeping stale metric instance',
            this.name,
            { opts: instance.opts },
            key
          )
        }
        return this.metric.remove(
          ...Array.from(optsAsArgs(instance.opts, this.metric.labelNames) || [])
        )
      }
    })

    if (thresh > this.lastAccess) {
      if (process.env.DEBUG_METRICS) {
        // eslint-disable-next-line no-console
        console.log('Sweeping stale metric', this.name, thresh, this.lastAccess)
      }
      metrics.delete(this.name)
      return registry.removeSingleMetric(this.name)
    }
  }

  _execMethod(method, opts, value) {
    opts = extendOpts(opts, this.metric.labelNames)
    const key = optsKey(opts)
    if (key !== '') {
      this.instances.set(key, { time: new Date(), opts })
    }
    this.lastAccess = new Date()
    return this.metric[method](opts, value)
  }
}

let sweepingInterval
PromWrapper.setupSweeping = function () {
  if (sweepingInterval) {
    clearInterval(sweepingInterval)
  }
  if (!PromWrapper.ttlInMinutes) {
    if (process.env.DEBUG_METRICS) {
      // eslint-disable-next-line no-console
      console.log('Not registering sweep method -- empty ttl')
    }
    return
  }
  if (process.env.DEBUG_METRICS) {
    // eslint-disable-next-line no-console
    console.log('Registering sweep method')
  }
  sweepingInterval = setInterval(function () {
    if (process.env.DEBUG_METRICS) {
      // eslint-disable-next-line no-console
      console.log('Sweeping metrics')
    }
    return metrics.forEach((metric, key) => {
      return metric.sweep()
    })
  }, 60000)

  const Metrics = require('./index')
  Metrics.registerDestructor(() => clearInterval(sweepingInterval))
}

module.exports = PromWrapper
