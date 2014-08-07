Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
Keys = require('./RedisKeyBuilder')
redis = require('redis')
UpdateManager = require('./UpdateManager')

module.exports = WorkersManager =
	createWorker: () ->
		redisConf = Settings.redis.web
		client = redis.createClient(redisConf.port, redisConf.host)
		client.auth(redisConf.password)
		
		worker = {
			client: client
			waitForAndProcessUpdate: (callback = (error) ->) ->
				worker.client.blpop "pending-updates-list", 0, (error, result) ->
					return callback(error) if error?
					return callback() if !result?
					[list_name, doc_key] = result
					[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
					UpdateManager.processOutstandingUpdatesWithLock project_id, doc_id, (error) ->
						logger.error err: error, project_id: project_id, doc_id: doc_id, "error processing update" if error?
						return callback(error) if error?
						return callback()
						
			run: () ->
				return if Settings.shuttingDown
				worker.waitForAndProcessUpdate (error) =>
					if error?
						logger.error err: error, "Error in worker process, waiting 1 second before continuing"
						setTimeout () ->
							worker.run()
						, 1000
					else
						worker.run()
		}
		
		return worker
		
	createAndStartWorkers: (number) ->
		for i in [1..number]
			worker = WorkersManager.createWorker()
			worker.run()