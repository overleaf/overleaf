/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = {
  monitor(mongodbRequirePath, logger) {
    let mongodb, mongodbCore
    try {
      // for the v1 driver the methods to wrap are in the mongodb
      // module in lib/mongodb/db.js
      mongodb = require(mongodbRequirePath)
    } catch (error) {}

    try {
      // for the v2 driver the relevant methods are in the mongodb-core
      // module in lib/topologies/{server,replset,mongos}.js
      const v2Path = mongodbRequirePath.replace(/\/mongodb$/, '/mongodb-core')
      mongodbCore = require(v2Path)
    } catch (error1) {}

    const Metrics = require('./index')

    const monitorMethod = function (base, method, type) {
      let _method
      if (base == null) {
        return
      }
      if ((_method = base[method]) == null) {
        return
      }
      const arglen = _method.length

      const mongoDriverV1Wrapper = function (dbCommand, options, callback) {
        let query
        if (typeof callback === 'undefined') {
          callback = options
          options = {}
        }

        const collection = dbCommand.collectionName
        if (collection.match(/\$cmd$/)) {
          // Ignore noisy command methods like authenticating, ismaster and ping
          return _method.call(this, dbCommand, options, callback)
        }

        if (dbCommand.query != null) {
          query = Object.keys(dbCommand.query).sort().join('_')
        }

        const timer = new Metrics.Timer('mongo', { collection, query })
        const start = new Date()
        return _method.call(this, dbCommand, options, function () {
          timer.done()
          logger.debug(
            {
              query: dbCommand.query,
              query_type: type,
              collection,
              'response-time': new Date() - start,
            },
            'mongo request'
          )
          return callback.apply(this, arguments)
        })
      }

      const mongoDriverV2Wrapper = function (ns, ops, options, callback) {
        let query
        if (typeof callback === 'undefined') {
          callback = options
          options = {}
        }

        if (ns.match(/\$cmd$/)) {
          // Ignore noisy command methods like authenticating, ismaster and ping
          return _method.call(this, ns, ops, options, callback)
        }

        let key = `mongo-requests.${ns}.${type}`
        if (ops[0].q != null) {
          // ops[0].q
          query = Object.keys(ops[0].q).sort().join('_')
          key += '.' + query
        }

        const timer = new Metrics.Timer(key)
        const start = new Date()
        return _method.call(this, ns, ops, options, function () {
          timer.done()
          logger.debug(
            {
              query: ops[0].q,
              query_type: type,
              collection: ns,
              'response-time': new Date() - start,
            },
            'mongo request'
          )
          return callback.apply(this, arguments)
        })
      }

      if (arglen === 3) {
        return (base[method] = mongoDriverV1Wrapper)
      } else if (arglen === 4) {
        return (base[method] = mongoDriverV2Wrapper)
      }
    }

    monitorMethod(
      mongodb != null ? mongodb.Db.prototype : undefined,
      '_executeQueryCommand',
      'query'
    )
    monitorMethod(
      mongodb != null ? mongodb.Db.prototype : undefined,
      '_executeRemoveCommand',
      'remove'
    )
    monitorMethod(
      mongodb != null ? mongodb.Db.prototype : undefined,
      '_executeInsertCommand',
      'insert'
    )
    monitorMethod(
      mongodb != null ? mongodb.Db.prototype : undefined,
      '_executeUpdateCommand',
      'update'
    )

    monitorMethod(
      mongodbCore != null ? mongodbCore.Server.prototype : undefined,
      'command',
      'command'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.Server.prototype : undefined,
      'remove',
      'remove'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.Server.prototype : undefined,
      'insert',
      'insert'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.Server.prototype : undefined,
      'update',
      'update'
    )

    monitorMethod(
      mongodbCore != null ? mongodbCore.ReplSet.prototype : undefined,
      'command',
      'command'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.ReplSet.prototype : undefined,
      'remove',
      'remove'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.ReplSet.prototype : undefined,
      'insert',
      'insert'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.ReplSet.prototype : undefined,
      'update',
      'update'
    )

    monitorMethod(
      mongodbCore != null ? mongodbCore.Mongos.prototype : undefined,
      'command',
      'command'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.Mongos.prototype : undefined,
      'remove',
      'remove'
    )
    monitorMethod(
      mongodbCore != null ? mongodbCore.Mongos.prototype : undefined,
      'insert',
      'insert'
    )
    return monitorMethod(
      mongodbCore != null ? mongodbCore.Mongos.prototype : undefined,
      'update',
      'update'
    )
  },
}
