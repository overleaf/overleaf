const Settings = require('@overleaf/settings')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
let keys = Settings.redis.documentupdater.key_schema
const async = require('async')
const RedisManager = require('../app/js/RedisManager')

const getKeysFromNode = function (node, pattern, callback) {
  let cursor = 0 // redis iterator
  const keySet = {} // use hash to avoid duplicate results
  // scan over all keys looking for pattern
  const doIteration = () =>
    node.scan(cursor, 'MATCH', pattern, 'COUNT', 1000, function (error, reply) {
      if (error) {
        return callback(error)
      }
      ;[cursor, keys] = reply
      console.log('SCAN', keys.length)
      for (const key of keys) {
        keySet[key] = true
      }
      if (cursor === '0') {
        // note redis returns string result not numeric
        return callback(null, Object.keys(keySet))
      } else {
        return doIteration()
      }
    })
  return doIteration()
}

const getKeys = function (pattern, callback) {
  const nodes = (typeof rclient.nodes === 'function'
    ? rclient.nodes('master')
    : undefined) || [rclient]
  console.log('GOT NODES', nodes.length)
  const doKeyLookupForNode = (node, cb) => getKeysFromNode(node, pattern, cb)
  return async.concatSeries(nodes, doKeyLookupForNode, callback)
}

const expireDocOps = callback =>
  getKeys(keys.docOps({ doc_id: '*' }), (error, keys) => {
    if (error) return callback(error)
    async.mapSeries(
      keys,
      function (key, cb) {
        console.log(`EXPIRE ${key} ${RedisManager.DOC_OPS_TTL}`)
        return rclient.expire(key, RedisManager.DOC_OPS_TTL, cb)
      },
      callback
    )
  })

setTimeout(
  () =>
    //  Give redis a chance to connect
    expireDocOps(function (error) {
      if (error) {
        throw error
      }
      return process.exit()
    }),
  1000
)
