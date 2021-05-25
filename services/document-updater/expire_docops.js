/* eslint-disable
    handle-callback-err,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const Settings = require('settings-sharelatex')
const rclient = require('@overleaf/redis-wrapper').createClient(
  Settings.redis.documentupdater
)
let keys = Settings.redis.documentupdater.key_schema
const async = require('async')
const RedisManager = require('./app/js/RedisManager')

const getKeysFromNode = function (node, pattern, callback) {
  let cursor = 0 // redis iterator
  const keySet = {} // use hash to avoid duplicate results
  // scan over all keys looking for pattern
  var doIteration = (cb) =>
    node.scan(cursor, 'MATCH', pattern, 'COUNT', 1000, function (error, reply) {
      if (error != null) {
        return callback(error)
      }
      ;[cursor, keys] = Array.from(reply)
      console.log('SCAN', keys.length)
      for (const key of Array.from(keys)) {
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

const TTL = 60 * 60 // 1 hour
const expireDocOps = (callback) =>
  getKeys(keys.docOps({ doc_id: '*' }), (error, keys) =>
    async.mapSeries(
      keys,
      function (key, cb) {
        console.log(`EXPIRE ${key} ${RedisManager.DOC_OPS_TTL}`)
        return rclient.expire(key, RedisManager.DOC_OPS_TTL, cb)
      },
      callback
    )
  )

setTimeout(
  () =>
    //  Give redis a chance to connect
    expireDocOps(function (error) {
      if (error != null) {
        throw error
      }
      return process.exit()
    }),
  1000
)
