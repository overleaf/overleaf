const RedisWrapper = require('@overleaf/redis-wrapper')
const Settings = require('@overleaf/settings')
const SessionManager = require('../app/src/Features/Authentication/SessionManager')
const async = require('async')
const _ = require('lodash')

const redis = RedisWrapper.createClient(Settings.redis.web)

let totalDeletedSessions = 0

const queue = async.queue(function (sessKey, callback) {
  const cb = _.once(callback)
  redis.get(sessKey, (_err, session) => {
    try {
      if (SessionManager.isUserLoggedIn(JSON.parse(session))) {
        cb()
      } else {
        redis.del(sessKey, () => {
          totalDeletedSessions++
          if (totalDeletedSessions % 1000 === 0) {
            console.log(`Keys deleted so far: ${totalDeletedSessions}`)
          }
          cb()
        })
      }
    } catch (err) {
      console.log(`${sessKey} couldn't parse`)
      cb()
    }
  })
}, 20)

function scanAndPurge(cb) {
  const stream = redis.scanStream({
    match: 'sess:*',
    count: 1000,
  })
  console.log('starting scan')

  stream.on('data', resultKeys => {
    console.log(`Keys found, count:${resultKeys.length}`)
    queue.push(resultKeys)
  })

  stream.on('end', () => {
    queue.drain = () => {
      console.log(
        `All sessions have been checked, ${totalDeletedSessions} deleted`
      )
      cb()
    }
  })

  stream.on('error', err => {
    console.log(err)
  })
}

scanAndPurge(err => {
  console.error(err)
  process.exit()
})
