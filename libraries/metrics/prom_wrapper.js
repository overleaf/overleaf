const logger = require('@overleaf/logger')
const prom = require('prom-client')
const registry = require('prom-client').register
const metrics = new Map()

const labelsKey = function (labels) {
  let keys = Object.keys(labels)
  if (keys.length === 0) {
    return ''
  }

  keys = keys.sort()

  let hash = ''
  for (const key of keys) {
    if (hash.length) {
      hash += ','
    }
    hash += `${key}:${labels[key]}`
  }

  return hash
}

const labelsAsArgs = function (labels, labelNames) {
  const args = []
  for (const label of labelNames) {
    args.push(labels[label] || '')
  }
  return args
}

const PromWrapper = {
  ttlInMinutes: 0,
  registry,

  metric(type, name, labels, buckets) {
    return metrics.get(name) || new MetricWrapper(type, name, labels, buckets)
  },

  collectDefaultMetrics: prom.collectDefaultMetrics,
}

class MetricWrapper {
  constructor(type, name, labels, buckets) {
    metrics.set(name, this)
    this.name = name
    this.instances = new Map()
    this.lastAccess = new Date()

    const labelNames = labels ? Object.keys(labels) : []
    switch (type) {
      case 'counter':
        this.metric = new prom.Counter({
          name,
          help: name,
          labelNames,
        })
        break
      case 'histogram':
        this.metric = new prom.Histogram({
          name,
          help: name,
          labelNames,
          buckets,
        })
        break
      case 'summary':
        this.metric = new prom.Summary({
          name,
          help: name,
          maxAgeSeconds: 60,
          ageBuckets: 10,
          labelNames,
        })
        break
      case 'gauge':
        this.metric = new prom.Gauge({
          name,
          help: name,
          labelNames,
        })
        break
      default:
        throw new Error(`Unknown metric type: ${type}`)
    }
  }

  inc(labels, value) {
    this._execMethod('inc', labels, value)
  }

  observe(labels, value) {
    this._execMethod('observe', labels, value)
  }

  set(labels, value) {
    this._execMethod('set', labels, value)
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
            { labels: instance.labels },
            key
          )
        }
        this.metric.remove(
          ...labelsAsArgs(instance.labels, this.metric.labelNames)
        )
      }
    })

    if (thresh > this.lastAccess) {
      if (process.env.DEBUG_METRICS) {
        // eslint-disable-next-line no-console
        console.log('Sweeping stale metric', this.name, thresh, this.lastAccess)
      }
      metrics.delete(this.name)
      registry.removeSingleMetric(this.name)
    }
  }

  _execMethod(method, labels, value) {
    const key = labelsKey(labels)
    if (key !== '') {
      this.instances.set(key, { time: new Date(), labels })
    }
    this.lastAccess = new Date()
    try {
      this.metric[method](labels, value)
    } catch (err) {
      logger.warn(
        { err, metric: this.metric.name, labels },
        'failed to record metric'
      )
    }
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
    metrics.forEach((metric, key) => {
      metric.sweep()
    })
  }, 60000)

  const Metrics = require('./index')
  Metrics.registerDestructor(() => clearInterval(sweepingInterval))
}

module.exports = PromWrapper
