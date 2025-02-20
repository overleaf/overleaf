import redis from '@overleaf/redis-wrapper'
import config from 'config'

const redisOptions = config.get('redis.queue')

console.log('REDIS CONFIG', redisOptions)
const rclient = redis.createClient(redisOptions)

try {
  await rclient.healthCheck()
  console.log('REDIS HEALTHCHECK SUCCEEDED')
} catch (error) {
  console.error('REDIS HEALTHCHECK FAILED', error)
} finally {
  await rclient.quit()
}
