const Metrics = require('../../..')

const { expect } = require('chai')
const prom = require('prom-client')

describe('mongodb', function () {
  beforeEach(function () {
    prom.register.clear()
    this.pool = {
      totalConnectionCount: 8,
      availableConnectionCount: 2,
      waitQueueSize: 4,
      options: { maxPoolSize: 10 },
    }
    this.servers = new Map([['server1', { s: { pool: this.pool } }]])

    this.mongoClient = { topology: { s: { servers: this.servers } } }
  })

  it('handles an unconnected client', async function () {
    const mongoClient = {}
    Metrics.mongodb.monitor(mongoClient)
    const metrics = await getMetrics()
    expect(metrics).to.deep.equal({})
  })

  it('collects Mongo metrics', async function () {
    Metrics.mongodb.monitor(this.mongoClient)
    const metrics = await getMetrics()
    expect(metrics).to.deep.equal({
      'mongo_connection_pool_max:server1': 10,
      'mongo_connection_pool_size:server1': 8,
      'mongo_connection_pool_available:server1': 2,
      'mongo_connection_pool_waiting:server1': 4,
    })
  })

  it('handles topology changes', async function () {
    Metrics.mongodb.monitor(this.mongoClient)
    let metrics = await getMetrics()
    expect(metrics).to.deep.equal({
      'mongo_connection_pool_max:server1': 10,
      'mongo_connection_pool_size:server1': 8,
      'mongo_connection_pool_available:server1': 2,
      'mongo_connection_pool_waiting:server1': 4,
    })

    // Add a server
    this.servers.set('server2', this.servers.get('server1'))
    metrics = await getMetrics()
    expect(metrics).to.deep.equal({
      'mongo_connection_pool_max:server1': 10,
      'mongo_connection_pool_size:server1': 8,
      'mongo_connection_pool_available:server1': 2,
      'mongo_connection_pool_waiting:server1': 4,
      'mongo_connection_pool_max:server2': 10,
      'mongo_connection_pool_size:server2': 8,
      'mongo_connection_pool_available:server2': 2,
      'mongo_connection_pool_waiting:server2': 4,
    })

    // Delete a server
    this.servers.delete('server1')
    metrics = await getMetrics()
    expect(metrics).to.deep.equal({
      'mongo_connection_pool_max:server2': 10,
      'mongo_connection_pool_size:server2': 8,
      'mongo_connection_pool_available:server2': 2,
      'mongo_connection_pool_waiting:server2': 4,
    })

    // Delete another server
    this.servers.delete('server2')
    metrics = await getMetrics()
    expect(metrics).to.deep.equal({})
  })
})

async function getMetrics() {
  const metrics = await prom.register.getMetricsAsJSON()
  const result = {}
  for (const metric of metrics) {
    for (const value of metric.values) {
      const key = `${metric.name}:${value.labels.mongo_server}`
      result[key] = value.value
    }
  }
  return result
}
