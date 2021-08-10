const os = require('os')
const http = require('http')
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
      expect(labels.host).to.equal('global')
      expect(labels.app).to.equal(APP_NAME)
    })
  })

  describe('open_sockets', function() {
    const keyServer1 = 'open_connections_http_127_42_42_1'
    const keyServer2 = 'open_connections_http_127_42_42_2'

    let finish1, finish2, emitResponse1, emitResponse2
    function resetEmitResponse1() {
      emitResponse1 = new Promise(resolve => (finish1 = resolve))
    }
    resetEmitResponse1()
    function resetEmitResponse2() {
      emitResponse2 = new Promise(resolve => (finish2 = resolve))
    }
    resetEmitResponse2()

    let server1, server2
    before(function setupServer1(done) {
      server1 = http.createServer((req, res) => {
        res.write('...')
        emitResponse1.then(() => res.end())
      })
      server1.listen(0, '127.42.42.1', done)
    })
    before(function setupServer2(done) {
      server2 = http.createServer((req, res) => {
        res.write('...')
        emitResponse2.then(() => res.end())
      })
      server2.listen(0, '127.42.42.2', done)
    })
    after(function cleanupPendingRequests() {
      finish1()
      finish2()
    })
    after(function shutdownServer1(done) {
      if (server1) server1.close(done)
    })
    after(function shutdownServer2(done) {
      if (server2) server2.close(done)
    })

    let urlServer1, urlServer2
    before(function setUrls() {
      urlServer1 = `http://127.42.42.1:${server1.address().port}/`
      urlServer2 = `http://127.42.42.2:${server2.address().port}/`
    })
    describe('gaugeOpenSockets()', function() {
      beforeEach(function runGaugeOpenSockets() {
        Metrics.open_sockets.gaugeOpenSockets()
      })

      describe('without pending connections', function() {
        it('emits no open_connections', async function() {
          await expectNoMetricValue(keyServer1)
          await expectNoMetricValue(keyServer2)
        })
      })

      describe('with pending connections for server1', function() {
        before(function(done) {
          http.get(urlServer1)
          http.get(urlServer1)
          setTimeout(done, 10)
        })

        it('emits 2 open_connections for server1', async function() {
          await expectMetricValue(keyServer1, 2)
        })

        it('emits no open_connections for server2', async function() {
          await expectNoMetricValue(keyServer2)
        })
      })

      describe('with pending connections for server1 and server2', function() {
        before(function(done) {
          http.get(urlServer2)
          http.get(urlServer2)
          setTimeout(done, 10)
        })

        it('emits 2 open_connections for server1', async function() {
          await expectMetricValue(keyServer1, 2)
        })

        it('emits 2 open_connections for server2', async function() {
          await expectMetricValue(keyServer2, 2)
        })
      })

      describe('when requests finish for server1', function() {
        before(function(done) {
          finish1()
          resetEmitResponse1()
          http.get(urlServer1)

          setTimeout(done, 10)
        })

        it('emits 1 open_connections for server1', async function() {
          await expectMetricValue(keyServer1, 1)
        })

        it('emits 2 open_connections for server2', async function() {
          await expectMetricValue(keyServer2, 2)
        })
      })

      describe('when all requests complete', function() {
        before(function(done) {
          finish1()
          finish2()

          setTimeout(done, 10)
        })

        it('emits no open_connections', async function() {
          await expectNoMetricValue(keyServer1)
          await expectNoMetricValue(keyServer2)
        })
      })
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
  const metrics = await Metrics.register.getMetricsAsJSON()
  const metric = metrics.find(m => m.name === key)
  return metric.values[0]
}

async function expectMetricValue(key, expectedValue) {
  const value = await getMetricValue(key)
  expect(value.value).to.equal(expectedValue)
  expect(value.labels.host).to.equal(HOSTNAME)
  expect(value.labels.app).to.equal(APP_NAME)
}

async function expectNoMetricValue(key) {
  const metric = getMetric(key)
  if (!metric) return
  await expectMetricValue(key, 0)
}
