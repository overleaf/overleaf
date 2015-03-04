ASpellWorker = require "./ASpellWorker"
_ = require "underscore"

class ASpellWorkerPool
	constructor: (@options) ->
		@PROCESS_POOL = []
		@timeout = 1000

	create: (language) ->
		worker = new ASpellWorker(language, @options)
		worker.pipe.on 'exit', () =>
			@cleanup
		@PROCESS_POOL.push(worker)
		return worker

	cleanup: () ->
		active = @PROCESS_POOL.filter (worker) ->
			worker.state != 'killed'
		@PROCESS_POOL = active

	check: (language, words, timeout, callback) ->
		# look for an existing process in the pool
		availableWorker = _.find @PROCESS_POOL, (cached) ->
			cached.language == language && cached.isReady()
		if not availableWorker?
			worker = @create(language)
		else
			worker = availableWorker

		timer = setTimeout () ->
			worker.pipe.kill('SIGKILL')
		, timeout || 1000
		worker.check words, (err, output) ->
			clearTimeout timer
			callback(err, output)

module.exports = ASpellWorkerPool
