child_process = require("child_process")
logger = require 'logger-sharelatex'

BATCH_SIZE = 100

class ASpellWorker
	constructor: (language) ->
		@language = language
		@count = 0
		@pipe = child_process.spawn("aspell", ["pipe", "-t", "--encoding=utf-8", "-d", language])
		logger.log process: @pipe.pid, lang: @language, "starting new aspell worker"
		@pipe.on 'exit', () =>
			@state = 'killed'
			logger.log process: @pipe.pid, lang: @language, "aspell worker has exited"
		@pipe.on 'error', (err) =>
			@state = 'error'
			@callback err, []
		@pipe.stdin.on 'error', (err) =>
			@state = 'error'
			@callback err, []

		output = ""
		@pipe.stdout.on "data", (chunk) =>
			output = output + chunk
			# We receive a single "*" from Aspell as the end of data marker
			if chunk.toString().match(/^\*$/m)
				@callback(null, output.slice())
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
		@callback = callback
		@setEndOfStreamMarker()
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
		@sendCommand("%")		# take the aspell pipe out of terse mode so we can look for a '*'
		@sendCommand("^ENDOFSTREAMMARKER") # send our marker which will generate a '*'
		@sendCommand("!")		# go back into terse mode

	shutdown: (reason) ->
		logger.log process: @pipe.pid, reason: reason, 'shutting down'
		@state = "closing"
		@pipe.stdin.end()

	setEndOfStreamMarker: () ->
		return if @setup
		@sendCommand("@ENDOFSTREAMMARKER") # make this string a valid word
		@setup = true

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
