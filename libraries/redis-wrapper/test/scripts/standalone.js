// execute this script with a redis container running to test the health check
// starting and stopping redis with this script running is a good test

const redis = require('../../')
const logger = require('@overleaf/logger')

const rclient = redis.createClient({ host: 'localhost', port: '6379' })

setInterval(() => {
  rclient.healthCheck(err => {
    if (err) {
      logger.error({ err }, 'HEALTH CHECK FAILED')
    } else {
      logger.log('HEALTH CHECK OK')
    }
  })
}, 1000)
