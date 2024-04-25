// execute this script with a redis container running to test the health check
// starting and stopping redis with this script running is a good test

const redis = require('../../')
const logger = require('@overleaf/logger')

const rclient = redis.createClient({ host: '127.0.0.1', port: '6379' })

setInterval(() => {
  rclient.healthCheck(err => {
    if (err) {
      logger.error({ err }, 'HEALTH CHECK FAILED')
    } else {
      logger.info('HEALTH CHECK OK')
    }
  })
}, 1000)
