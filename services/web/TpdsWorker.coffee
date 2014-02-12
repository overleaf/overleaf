async = require('async')
request = require('request')
keys = require('./app/js/infrastructure/Keys')
settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
_ = require('underscore')
childProcess = require("child_process")
metrics = require("./app/js/infrastructure/Metrics")

fiveMinutes = 5 * 60 * 1000


processingFuncs =

	sendDoc : (options, callback)->
		if !options.docLines? || options.docLines.length == 0
			logger.err options:options, "doc lines not added to options for processing"
			return callback()
		docLines = options.docLines.reduce (singleLine, line)-> "#{singleLine}\n#{line}"
		post = request(options)
		post.on 'error', (err)->
			if err?
				callback(err)
			else
				callback()
		post.on 'end', callback
		post.write(docLines, 'utf-8')

	standardHttpRequest: (options, callback)->
		request options, (err, reponse, body)->
			if err?
				callback(err)
			else
				callback()

	pipeStreamFrom: (options, callback)->
		if options.filePath == "/droppy/main.tex"
			request options.streamOrigin, (err,res, body)->
				logger.log options:options, body:body
		origin = request(options.streamOrigin)
		origin.on 'error', (err)->
			logger.error err:err, options:options, "something went wrong in pipeStreamFrom origin"
			if err?
				callback(err)
			else
				callback()
		dest = request(options)
		origin.pipe(dest)
		dest.on "error", (err)->
			logger.error err:err, options:options, "something went wrong in pipeStreamFrom dest"
			if err?
				callback(err)
			else
				callback()
		dest.on 'end', callback


workerRegistration = (groupKey, method, options, callback)->
	callback = _.once callback
	setTimeout callback, fiveMinutes
	metrics.inc "tpds-worker-processing"
	logger.log groupKey:groupKey, method:method, options:options, "processing http request from queue"
	processingFuncs[method] options, (err)->
		if err?
			logger.err err:err, user_id:groupKey, method:method, options:options, "something went wrong processing tpdsUpdateSender update"
			return callback("skip-after-retry")
		callback()


setupWebToTpdsWorkers = (queueName)->
	logger.log worker_count:worker_count, queueName:queueName, "fairy workers"
	worker_count = 4
	while worker_count-- > 0
		workerQueueRef = require('fairy').connect(settings.redis.fairy).queue(queueName)
		workerQueueRef.polling_interval = 100
		workerQueueRef.regist workerRegistration


cleanupPreviousQueues = (queueName, callback)->
	#cleanup queues then setup workers
	fairy = require('fairy').connect(settings.redis.fairy)
	queuePrefix = "FAIRY:QUEUED:#{queueName}:"
	fairy.redis.keys "#{queuePrefix}*", (err, keys)->
		logger.log "#{keys.length} fairy queues need cleanup"
		queueNames = keys.map (key)->
			key.replace queuePrefix, ""
		cleanupJobs = queueNames.map (projectQueueName)->
			return (cb)->
				cleanup = childProcess.fork(__dirname + '/cleanup.js', [queueName, projectQueueName])
				cleanup.on 'exit', cb
		async.series cleanupJobs, callback


cleanupPreviousQueues keys.queue.web_to_tpds_http_requests, ->
	setupWebToTpdsWorkers keys.queue.web_to_tpds_http_requests

cleanupPreviousQueues keys.queue.tpds_to_web_http_requests, ->
	setupWebToTpdsWorkers keys.queue.tpds_to_web_http_requests
