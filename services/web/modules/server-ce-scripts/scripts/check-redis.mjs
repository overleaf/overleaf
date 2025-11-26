import RedisWrapper from '../../../app/src/infrastructure/RedisWrapper.js'
const rclient = RedisWrapper.client('health_check')
rclient.on('error', err => {
  console.error('Cannot connect to redis.')
  console.error(err)
  process.exit(1)
})

rclient.healthCheck(err => {
  if (err) {
    console.error('Cannot connect to redis.')
    console.error(err)
    process.exit(1)
  } else {
    console.error('Redis is up.')
    process.exit(0)
  }
})
