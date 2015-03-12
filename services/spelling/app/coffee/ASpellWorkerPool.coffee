ASpellWorker = require "./ASpellWorker"
_ = require "underscore"
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')

class ASpellWorkerPool
	MAX_REQUESTS: 100*1024
	MAX_WORKERS: 32

	constructor: (@options) ->
		@PROCESS_POOL = []
		@timeout = 1000

	create: (language) ->
		if @PROCESS_POOL.length >= @MAX_WORKERS
			logger.log maxworkers: @MAX_WORKERS, "maximum number of workers already running"
			return null
		worker = new ASpellWorker(language, @options)
		worker.pipe.on 'exit', () =>
			logger.log process: worker.pipe.pid, lang: language, "removing aspell worker from pool"
			@cleanup()
		@PROCESS_POOL.push(worker)
		metrics.gauge 'aspellWorkerPool-size', @PROCESS_POOL.length
		return worker

	cleanup: () ->
		active = @PROCESS_POOL.filter (worker) ->
			worker.state != 'killed'
		@PROCESS_POOL = active
		metrics.gauge 'aspellWorkerPool-size', @PROCESS_POOL.length

	check: (language, words, timeout, callback) ->
		# look for an existing process in the pool
		availableWorker = _.find @PROCESS_POOL, (cached) ->
			cached.language == language && cached.isReady()
		if not availableWorker?
			worker = @create(language)
		else
			worker = availableWorker

		if not worker?
			# return error if too many workers
			callback(new Error("no worker available"))
			return

		if worker.idleTimer?
			clearTimeout worker.idleTimer
			worker.idleTimer = null

		killTimer = setTimeout () ->
			worker.pipe.kill('SIGKILL')
		, timeout || 1000

		worker.check words, (err, output) =>
			clearTimeout killTimer
			callback(err, output)
			return if err? # process has shut down
			if worker.count > @MAX_REQUESTS
				worker.shutdown("reached limit of " + @MAX_REQUESTS + " requests")
			else
				# queue a shutdown if worker is idle
				worker.idleTimer = setTimeout () ->
					worker.shutdown("idle worker")
					worker.idleTimer = null
				, 1000

module.exports = ASpellWorkerPool
