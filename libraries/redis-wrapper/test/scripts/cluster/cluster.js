/*
  execute this script with a redis cluster running to test the health check.
  starting and stopping shards with this script running is a good test.

  to create a new cluster, use $ ./create-redis-cluster.sh
  to run a chaos monkey, use $ ./clear-dbs.sh
*/

const redis = require('../../../')
const logger = require('@overleaf/logger')

const rclient = redis.createClient({
  cluster: Array.from({ length: 9 }).map((value, index) => {
    return { host: '127.0.0.1', port: 7000 + index }
  }),
})

setInterval(() => {
  rclient.healthCheck(err => {
    if (err) {
      logger.error({ err }, 'HEALTH CHECK FAILED')
    } else {
      logger.info('HEALTH CHECK OK')
    }
  })
}, 1000)
