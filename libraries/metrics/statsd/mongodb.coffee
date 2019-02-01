module.exports =
	monitor: (mongodb_require_path, logger) ->

		try
			# for the v1 driver the methods to wrap are in the mongodb
			# module in lib/mongodb/db.js
			mongodb = require("#{mongodb_require_path}")

		try
			# for the v2 driver the relevant methods are in the mongodb-core
			# module in lib/topologies/{server,replset,mongos}.js
			v2_path = mongodb_require_path.replace(/\/mongodb$/, '/mongodb-core')
			mongodbCore = require(v2_path)

		Metrics = require("./metrics")

		monitorMethod = (base, method, type) ->
			return unless base?
			return unless (_method = base[method])?
			arglen = _method.length

			mongo_driver_v1_wrapper = (db_command, options, callback) ->
				if (typeof callback == 'undefined')
					callback = options
					options = {}

				collection = db_command.collectionName
				if collection.match(/\$cmd$/)
					# Ignore noisy command methods like authenticating, ismaster and ping
					return _method.call this, db_command, options, callback

				key = "mongo-requests.#{collection}.#{type}"
				if db_command.query?
					query = Object.keys(db_command.query).sort().join("_")
					key += "." + query

				timer = new Metrics.Timer(key)
				start = new Date()
				_method.call this, db_command, options, () ->
					timer.done()
					time = new Date() - start
					logger.log
						query: db_command.query
						query_type: type
						collection: collection
						"response-time": new Date() - start
						"mongo request"
					callback.apply this, arguments

			mongo_driver_v2_wrapper = (ns, ops, options, callback) ->
				if (typeof callback == 'undefined')
					callback = options
					options = {}

				if ns.match(/\$cmd$/)
					# Ignore noisy command methods like authenticating, ismaster and ping
					return _method.call this, ns, ops, options, callback

				key = "mongo-requests.#{ns}.#{type}"
				if ops[0].q?  # ops[0].q
					query = Object.keys(ops[0].q).sort().join("_")
					key += "." + query

				timer = new Metrics.Timer(key)
				start = new Date()
				_method.call this, ns, ops, options, () ->
					timer.done()
					time = new Date() - start
					logger.log
						query: ops[0].q
						query_type: type
						collection: ns
						"response-time": new Date() - start
						"mongo request"
					callback.apply this, arguments

			if arglen == 3
				base[method] = mongo_driver_v1_wrapper
			else if arglen == 4
				base[method] = mongo_driver_v2_wrapper

		monitorMethod(mongodb?.Db.prototype, "_executeQueryCommand",  "query")
		monitorMethod(mongodb?.Db.prototype, "_executeRemoveCommand", "remove")
		monitorMethod(mongodb?.Db.prototype, "_executeInsertCommand", "insert")
		monitorMethod(mongodb?.Db.prototype, "_executeUpdateCommand", "update")

		monitorMethod(mongodbCore?.Server.prototype, "command", "command")
		monitorMethod(mongodbCore?.Server.prototype, "remove", "remove")
		monitorMethod(mongodbCore?.Server.prototype, "insert", "insert")
		monitorMethod(mongodbCore?.Server.prototype, "update", "update")

		monitorMethod(mongodbCore?.ReplSet.prototype, "command", "command")
		monitorMethod(mongodbCore?.ReplSet.prototype, "remove", "remove")
		monitorMethod(mongodbCore?.ReplSet.prototype, "insert", "insert")
		monitorMethod(mongodbCore?.ReplSet.prototype, "update", "update")

		monitorMethod(mongodbCore?.Mongos.prototype, "command", "command")
		monitorMethod(mongodbCore?.Mongos.prototype, "remove", "remove")
		monitorMethod(mongodbCore?.Mongos.prototype, "insert", "insert")
		monitorMethod(mongodbCore?.Mongos.prototype, "update", "update")
