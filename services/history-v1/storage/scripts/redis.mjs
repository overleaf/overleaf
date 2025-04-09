import redis from '@overleaf/redis-wrapper'
import config from 'config'

// Get allowed Redis dbs from config
const redisConfig = config.get('redis')
const allowedDbs = Object.keys(redisConfig)

// Get the Redis db from command line argument or use the first available db as default
const db = process.argv[2]

// Validate redis db
if (!allowedDbs.includes(db)) {
  if (db) {
    console.error('Invalid redis db:', db)
  }
  console.error(`Usage: node redis.mjs [${allowedDbs.join('|')}]`)
  process.exit(1)
}

// Get redis options based on command line argument
const redisOptions = config.get(`redis.${db}`)
console.log('Using redis db:', db)
console.log('REDIS CONFIG', {
  ...redisOptions,
  password: '*'.repeat(redisOptions.password?.length),
})
const rclient = redis.createClient(redisOptions)

try {
  await rclient.healthCheck()
  console.log('REDIS HEALTHCHECK SUCCEEDED')
} catch (error) {
  console.error('REDIS HEALTHCHECK FAILED', error)
} finally {
  await rclient.quit()
}
