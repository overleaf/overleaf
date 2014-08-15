child_process = require("child_process")
async = require "async"
_ = require "underscore"


class ASpellRunner
	checkWords: (language, words, callback = (error, result) ->) ->
		@runAspellOnWords language, words, (error, output) =>
			return callback(error) if error?
			output = @removeAspellHeader(output)
			suggestions = @getSuggestions(output)
			results = []
			for word, i in words
				if suggestions[word]?
					results.push index: i, suggestions: suggestions[word]
			callback null, results

	getSuggestions: (output) ->
		lines = output.split("\n")
		suggestions = {}
		for line in lines
			if line[0] == "&" # Suggestions found
				parts = line.split(" ")
				if parts.length > 1
					word = parts[1]
					suggestionsString = line.slice(line.indexOf(":") + 2)
					suggestions[word] = suggestionsString.split(", ")
			else if line[0] == "#" # No suggestions
				parts = line.split(" ")
				if parts.length > 1
					word = parts[1]
					suggestions[word] = []
		return suggestions
	
	removeAspellHeader: (output) -> output.slice(1)

	runAspellOnWords: (language, words, callback = (error, output) ->) ->
		@open(language)
		@captureOutput(callback)
		@setTerseMode()
		start = new Date()
		i = 0
		do tick = () =>
			if new Date() - start > ASpell.ASPELL_TIMEOUT
				@close(true)
			else if i < words.length
				word = words[i]
				@sendWord(word)
				i++
				process.nextTick tick
			else
				@close()

	captureOutput: (callback = (error, output) ->) ->
		output = ""
		error = ""
		@aspell.stdout.on "data", (chunk) ->
			output = output + chunk
		@aspell.stderr.on "data", (chunk) =>
			error = error + chunk
		@aspell.stdout.on "end", () ->
			if error == ""
				callback null, output
			else
				callback new Error(error), output

	open: (language) ->
		@finished = false
		@aspell = child_process.spawn("aspell", ["pipe", "-t", "--encoding=utf-8", "-d", language])

	close: (force) ->
		@finished = true
		@aspell.stdin.end()
		if force && !@aspell.exitCode?
			@aspell.kill("SIGKILL")

	setTerseMode: () ->
		@sendCommand("!")

	sendWord: (word) ->
		@sendCommand("^" + word)

	sendCommand: (command) ->
		@aspell.stdin.write(command + "\n")

module.exports = ASpell =
	# The description of how to call aspell from another program can be found here:
	# http://aspell.net/man-html/Through-A-Pipe.html
	checkWords: (language, words, callback = (error, result) ->) ->
		runner = new ASpellRunner()
		callback = _.once callback
		runner.checkWords language, words, callback

		forceClose = ->
			runner.close(true)
			callback("process killed")
		setTimeout forceClose, @ASPELL_TIMEOUT
	ASPELL_TIMEOUT : 4000


