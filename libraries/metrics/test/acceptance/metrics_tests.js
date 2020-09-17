const os = require('os')
const { expect } = require('chai')
const Metrics = require('../..')

const HOSTNAME = os.hostname()
const APP_NAME = 'test-app'

describe('Metrics module', function() {
  before(function() {
    Metrics.initialize(APP_NAME)
  })

  describe('at startup', function() {
    it('increments the process_startup counter', async function() {
      await expectMetricValue('process_startup', 1)
    })

    it('collects default metrics', async function() {
      const metric = await getMetric('process_cpu_user_seconds_total')
      expect(metric).to.exist
    })
  })

  describe('inc()', function() {
    it('increments counts by 1', async function() {
      Metrics.inc('duck_count')
      await expectMetricValue('duck_count', 1)
      Metrics.inc('duck_count')
      Metrics.inc('duck_count')
      await expectMetricValue('duck_count', 3)
    })

    it('escapes special characters in the key', async function() {
      Metrics.inc('show.me the $!!')
      await expectMetricValue('show_me_the____', 1)
    })
  })

  describe('count()', function() {
    it('increments counts by the given count', async function() {
      Metrics.count('rabbit_count', 5)
      await expectMetricValue('rabbit_count', 5)
      Metrics.count('rabbit_count', 6)
      Metrics.count('rabbit_count', 7)
      await expectMetricValue('rabbit_count', 18)
    })
  })

  describe('summary()', function() {
    it('collects observations', async function() {
      Metrics.summary('oven_temp', 200)
      Metrics.summary('oven_temp', 300)
      Metrics.summary('oven_temp', 450)
      const sum = await getSummarySum('oven_temp')
      expect(sum).to.equal(950)
    })
  })

  describe('timing()', function() {
    it('collects timings', async function() {
      Metrics.timing('sprint_100m', 10)
      Metrics.timing('sprint_100m', 20)
      Metrics.timing('sprint_100m', 30)
      const sum = await getSummarySum('timer_sprint_100m')
      expect(sum).to.equal(60)
    })
  })

  describe('gauge()', function() {
    it('records values', async function() {
      Metrics.gauge('water_level', 1.5)
      await expectMetricValue('water_level', 1.5)
      Metrics.gauge('water_level', 4.2)
      await expectMetricValue('water_level', 4.2)
    })
  })

  describe('globalGauge()', function() {
    it('records values without a host label', async function() {
      Metrics.globalGauge('tire_pressure', 99.99)
      const { value, labels } = await getMetricValue('tire_pressure')
      expect(value).to.equal(99.99)
      expect(labels.host).to.equal('')
      expect(labels.app).to.equal(APP_NAME)
    })
  })
})

function getMetric(key) {
  return Metrics.register.getSingleMetric(key)
}

async function getSummarySum(key) {
  const metric = getMetric(key)
  const item = await metric.get()
  for (const value of item.values) {
    if (value.metricName === `${key}_sum`) {
      return value.value
    }
  }
  return null
}

async function getMetricValue(key) {
  const metric = getMetric(key)
  const item = await metric.get()
  return item.values[0]
}

async function expectMetricValue(key, expectedValue) {
  const value = await getMetricValue(key)
  expect(value.value).to.equal(expectedValue)
  expect(value.labels.host).to.equal(HOSTNAME)
  expect(value.labels.app).to.equal(APP_NAME)
}
