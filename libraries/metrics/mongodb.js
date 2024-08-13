const { Gauge, Summary } = require('prom-client')

function monitor(mongoClient) {
  const labelNames = ['mongo_server']
  const poolSize = new Gauge({
    name: 'mongo_connection_pool_size',
    help: 'number of connections in the connection pool',
    labelNames,
    // Use this one metric's collect() to set all metrics' values.
    collect,
  })
  const availableConnections = new Gauge({
    name: 'mongo_connection_pool_available',
    help: 'number of connections that are not busy',
    labelNames,
  })
  const waitQueueSize = new Gauge({
    name: 'mongo_connection_pool_waiting',
    help: 'number of operations waiting for an available connection',
    labelNames,
  })
  const maxPoolSize = new Gauge({
    name: 'mongo_connection_pool_max',
    help: 'max size for the connection pool',
    labelNames,
  })

  const mongoCommandTimer = new Summary({
    name: 'mongo_command_time',
    help: 'time taken to complete a mongo command',
    percentiles: [],
    labelNames: ['status', 'method'],
  })

  if (mongoClient.on) {
    mongoClient.on('commandSucceeded', event => {
      mongoCommandTimer.observe(
        {
          status: 'success',
          method: event.commandName === 'find' ? 'read' : 'write',
        },
        event.duration
      )
    })

    mongoClient.on('commandFailed', event => {
      mongoCommandTimer.observe(
        {
          status: 'failed',
          method: event.commandName === 'find' ? 'read' : 'write',
        },
        event.duration
      )
    })
  }

  function collect() {
    // Reset all gauges in case they contain values for servers that
    // disappeared
    poolSize.reset()
    availableConnections.reset()
    waitQueueSize.reset()
    maxPoolSize.reset()

    const servers = mongoClient.topology?.s?.servers
    if (servers != null) {
      for (const [address, server] of servers) {
        // The server object is different between v4 and v5 (c.f. https://github.com/mongodb/node-mongodb-native/pull/3645)
        const pool = server.s?.pool || server.pool
        if (pool == null) {
          continue
        }

        const labels = { mongo_server: address }
        poolSize.set(labels, pool.totalConnectionCount)
        availableConnections.set(labels, pool.availableConnectionCount)
        waitQueueSize.set(labels, pool.waitQueueSize)
        maxPoolSize.set(labels, pool.options.maxPoolSize)
      }
    }
  }
}

module.exports = { monitor }
