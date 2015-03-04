child_process = require("child_process")

BATCH_SIZE = 100

class ASpellWorker
	constructor: (language) ->
		@language = language
		@pipe = child_process.spawn("aspell", ["pipe", "-t", "--encoding=utf-8", "-d", language])
		@pipe.on 'exit', () =>
			@state = 'killed'
		@pipe.on 'error', (err) =>
			@callback err, []
		@pipe.stdin.on 'error', (err) =>
			@callback err, []

		output = ""
		@pipe.stdout.on "data", (chunk) =>
			# TODO: strip aspell header
			output = output + chunk
			if chunk.toString().match(/^\*$/m)
				@callback(null, output.slice())
				output = ""
				error = ""
				@state = 'ready'

		error = ""
		@pipe.stderr.on "data", (chunk) =>
			error = error + chunk

		@pipe.stdout.on "end", () =>
			# process has ended, remove it from the active list
			if error == ""
				@callback(null, output.slice())
			else
				@callback new Error(error), output.slice()

	isReady: () ->
		return @state == 'ready'

	check: (words, callback) ->
		@state = 'ready'
		@callback = callback
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
		# send an end of data marker
		@sendCommand("%")   # take the aspell pipe out of terse mode so we can look for a '*'
		@sendCommand("end") # this is a valid word so it will generate a '*'
		@sendCommand("!")   # go back into terse mode

	shutdown: () ->
		@pipe.stdin.end()

	setTerseMode: () ->
		@sendCommand("!")

	sendWord: (word) ->
		@sendCommand("^" + word)

	sendWords: (words) ->
		# Aspell accepts multiple words to check on the same line
		# ^word1 word2 word3 ...
		# See aspell.info, writing programs to use Aspell Through A Pipe
		@sendCommand("^" + words.join(" "))

	sendCommand: (command) ->
		@pipe.stdin.write(command + "\n")

module.exports = ASpellWorker
