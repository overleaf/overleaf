_ = require("underscore")

module.exports =
	monitor: (mongodb_require_path, logger) ->
		Db = require("#{mongodb_require_path}/lib/mongodb/db").Db

		Metrics = require("./metrics")

		monitorMethod = (base, method, type) ->
			_method = base[method]

			base[method] = (db_command, options, callback) ->
				if (typeof callback == 'undefined')
					callback = options
					options = {}
					callback = () ->

				key = "mongo-requests.#{type}"
				if db_command.query?
					query = Object.keys(db_command.query).sort().join("_")
					key += "." + query

				Metrics.inc key
				timer = new Metrics.Timer(key)
				start = new Date()
				_method.call this, db_command, options, () ->
					timer.done()
					time = new Date() - start
					logger.log
						query: db_command.query
						type: type
						collection: db_command.collectionName
						"response-time": new Date() - start
						"mongo request"
					callback.apply this, arguments

		monitorMethod(Db.prototype, "_executeQueryCommand",  "query")
		monitorMethod(Db.prototype, "_executeRemoveCommand", "remove")
		monitorMethod(Db.prototype, "_executeInsertCommand", "insert")
		monitorMethod(Db.prototype, "_executeUpdateCommand", "update")