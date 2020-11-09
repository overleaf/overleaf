/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__, or convert again using --optional-chaining
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const _ = require('underscore')
const os = require('os')
const crypto = require('crypto')

// generate unique values for health check
const HOST = os.hostname()
const PID = process.pid
const RND = crypto.randomBytes(4).toString('hex')
let COUNT = 0

function createClient(opts) {
  let client, standardOpts
  if (opts == null) {
    opts = { port: 6379, host: 'localhost' }
  }
  if (opts.retry_max_delay == null) {
    opts.retry_max_delay = 5000 // ms
  }

  if (opts.cluster != null) {
    const Redis = require('ioredis')
    standardOpts = _.clone(opts)
    delete standardOpts.cluster
    delete standardOpts.key_schema
    client = new Redis.Cluster(opts.cluster, standardOpts)
    client.healthCheck = clusterHealthCheckBuilder(client)
    _monkeyPatchIoredisExec(client)
  } else {
    standardOpts = _.clone(opts)
    const ioredis = require('ioredis')
    client = new ioredis(standardOpts)
    _monkeyPatchIoredisExec(client)
    client.healthCheck = singleInstanceHealthCheckBuilder(client)
  }
  return client
}

const HEARTBEAT_TIMEOUT = 2000
function singleInstanceHealthCheckBuilder(client) {
  const healthCheck = (callback) => _checkClient(client, callback)
  return healthCheck
}

function clusterHealthCheckBuilder(client) {
  return singleInstanceHealthCheckBuilder(client)
}

function _checkClient(client, callback) {
  callback = _.once(callback)
  // check the redis connection by storing and retrieving a unique key/value pair
  const uniqueToken = `host=${HOST}:pid=${PID}:random=${RND}:time=${Date.now()}:count=${COUNT++}`
  const timer = setTimeout(function () {
    const error = new Error(
      `redis client health check timed out ${__guard__(
        client != null ? client.options : undefined,
        (x) => x.host
      )}`
    )
    console.error(
      {
        err: error,
        key: client.options != null ? client.options.key : undefined, // only present for cluster
        clientOptions: client.options,
        uniqueToken,
      },
      'client timed out'
    )
    return callback(error)
  }, HEARTBEAT_TIMEOUT)
  const healthCheckKey = `_redis-wrapper:healthCheckKey:{${uniqueToken}}`
  const healthCheckValue = `_redis-wrapper:healthCheckValue:{${uniqueToken}}`
  // set the unique key/value pair
  let multi = client.multi()
  multi.set(healthCheckKey, healthCheckValue, 'EX', 60)
  return multi.exec(function (err, reply) {
    if (err != null) {
      clearTimeout(timer)
      return callback(err)
    }
    // check that we can retrieve the unique key/value pair
    multi = client.multi()
    multi.get(healthCheckKey)
    multi.del(healthCheckKey)
    return multi.exec(function (err, reply) {
      clearTimeout(timer)
      if (err != null) {
        return callback(err)
      }
      if (
        (reply != null ? reply[0] : undefined) !== healthCheckValue ||
        (reply != null ? reply[1] : undefined) !== 1
      ) {
        return callback(new Error('bad response from redis health check'))
      }
      return callback()
    })
  })
}

function _monkeyPatchIoredisExec(client) {
  const _multi = client.multi
  return (client.multi = function (...args) {
    const multi = _multi.call(client, ...Array.from(args))
    const _exec = multi.exec
    multi.exec = function (callback) {
      if (callback == null) {
        callback = function () {}
      }
      return _exec.call(multi, function (error, result) {
        // ioredis exec returns an results like:
        // [ [null, 42], [null, "foo"] ]
        // where the first entries in each 2-tuple are
        // presumably errors for each individual command,
        // and the second entry is the result. We need to transform
        // this into the same result as the old redis driver:
        // [ 42, "foo" ]
        const filtered_result = []
        for (const entry of Array.from(result || [])) {
          if (entry[0] != null) {
            return callback(entry[0])
          } else {
            filtered_result.push(entry[1])
          }
        }
        return callback(error, filtered_result)
      })
    }
    return multi
  })
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

module.exports = {
  createClient,
}
