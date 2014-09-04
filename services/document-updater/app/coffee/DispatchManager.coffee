Settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
Keys = require('./RedisKeyBuilder')
redis = require('redis')
UpdateManager = require('./UpdateManager')
Metrics = require('./Metrics')

module.exports = DispatchManager =
	createDispatcher: () ->
		redisConf = Settings.redis.web
		client = redis.createClient(redisConf.port, redisConf.host)
		client.auth(redisConf.password)
		
		worker = {
			client: client
			_waitForUpdateThenDispatchWorker: (callback = (error) ->) ->
				timer = new Metrics.Timer "worker.waiting"
				worker.client.blpop "pending-updates-list", 0, (error, result) ->
					timer.done()
					return callback(error) if error?
					return callback() if !result?
					[list_name, doc_key] = result
					[project_id, doc_id] = Keys.splitProjectIdAndDocId(doc_key)
					# Dispatch this in the background
					UpdateManager.processOutstandingUpdatesWithLock project_id, doc_id, (error) ->
						logger.error err: error, project_id: project_id, doc_id: doc_id, "error processing update" if error?
					callback()
						
			run: () ->
				return if Settings.shuttingDown
				worker._waitForUpdateThenDispatchWorker (error) =>
					if error?
						logger.error err: error, "Error in worker process"
						throw error
					else
						worker.run()
		}
		
		return worker
		
	createAndStartDispatchers: (number) ->
		for i in [1..number]
			worker = DispatchManager.createDispatcher()
			worker.run()