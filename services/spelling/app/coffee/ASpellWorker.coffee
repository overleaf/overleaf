child_process = require("child_process")
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')
_ = require "underscore"

BATCH_SIZE = 100

class ASpellWorker
	constructor: (language) ->
		@language = language
		@count = 0
		@pipe = child_process.spawn("aspell", ["pipe", "-t", "--encoding=utf-8", "-d", language])
		logger.info process: @pipe.pid, lang: @language, "starting new aspell worker"
		metrics.inc "aspellWorker-start-" + @language
		@pipe.on 'exit', () =>
			@state = 'killed'
			logger.info process: @pipe.pid, lang: @language, "aspell worker has exited"
			metrics.inc "aspellWorker-exit-" + @language
		@pipe.on 'close', () =>
			@state = 'closed' unless @state == 'killed'
			if @callback?
				logger.err process: @pipe.pid, lang: @language, "aspell worker closed output streams with uncalled callback"
				@callback new Error("aspell worker closed output streams with uncalled callback"), []
				@callback = null
		@pipe.on 'error', (err) =>
			@state = 'error' unless @state == 'killed'
			logger.log process: @pipe.pid, error: err, stdout: output.slice(-1024), stderr: error.slice(-1024), lang: @language, "aspell worker error"
			if @callback?
				@callback err, []
				@callback = null
		@pipe.stdin.on 'error', (err) =>
			@state = 'error' unless @state == 'killed'
			logger.info process: @pipe.pid, error: err, stdout: output.slice(-1024), stderr: error.slice(-1024), lang: @language, "aspell worker error on stdin"
			if @callback?
				@callback err, []
				@callback = null

		output = ""
		endMarker = new RegExp("^[a-z][a-z]", "m")
		@pipe.stdout.on "data", (chunk) =>
			output = output + chunk
			# We receive the language code from Aspell as the end of data marker
			if chunk.toString().match(endMarker)
				if @callback?
					@callback(null, output.slice())
					@callback = null # only allow one callback in use
				else
					logger.err process: @pipe.pid, lang: @language, "end of data marker received when callback already used"
				@state = 'ready'
				output = ""
				error = ""

		error = ""
		@pipe.stderr.on "data", (chunk) =>
			error = error + chunk

		@pipe.stdout.on "end", () =>
			# process has ended
			@state = "end"

	isReady: () ->
		return @state == 'ready'

	check: (words, callback) ->
		# we will now send data to aspell, and be ready again when we
		# receive the end of data marker
		@state = 'busy'
		if @callback? # only allow one callback in use
			logger.err process: @pipe.pid, lang: @language, "CALLBACK ALREADY IN USE"
			return @callback new Error("Aspell callback already in use - SHOULD NOT HAPPEN")
		@callback = _.once callback # extra defence against double callback
		@setTerseMode()
		@write(words)
		@flush()

	write: (words) ->
		i = 0
		while i < words.length
			# batch up the words to check for efficiency
			batch = words.slice(i, i + BATCH_SIZE)
			@sendWords batch
			i += BATCH_SIZE

	flush: () ->
		# get aspell to send an end of data marker "*" when ready
		#@sendCommand("%")		# take the aspell pipe out of terse mode so we can look for a '*'
		#@sendCommand("^ENDOFSTREAMMARKER") # send our marker which will generate a '*'
		#@sendCommand("!")		# go back into terse mode
		@sendCommand("$$l")

	shutdown: (reason) ->
		logger.info process: @pipe.pid, reason: reason, 'shutting down'
		@state = "closing"
		@pipe.stdin.end()

	kill: (reason) ->
		logger.info process: @pipe.pid, reason: reason, 'killing'
		return if @state == 'killed'
		@pipe.kill('SIGKILL')

	setTerseMode: () ->
		@sendCommand("!")

	sendWord: (word) ->
		@sendCommand("^" + word)

	sendWords: (words) ->
		# Aspell accepts multiple words to check on the same line
		# ^word1 word2 word3 ...
		# See aspell.info, writing programs to use Aspell Through A Pipe
		@sendCommand("^" + words.join(" "))
		@count++

	sendCommand: (command) ->
		@pipe.stdin.write(command + "\n")

module.exports = ASpellWorker
