async = require "async"
_ = require "underscore"
ASpellWorkerPool = require "./ASpellWorkerPool"
LRU = require "lru-cache"
logger = require 'logger-sharelatex'

cache = LRU(10000)

class ASpellRunner
	checkWords: (language, words, callback = (error, result) ->) ->
		@runAspellOnWords language, words, (error, output) =>
			return callback(error) if error?
			#output = @removeAspellHeader(output)
			suggestions = @getSuggestions(language, output)
			results = []
			hits = 0
			addToCache = {}
			for word, i in words
				key = language + ':' + word
				cached = cache.get(key)
				if cached?
					hits++
					if	cached == true
						# valid word, no need to do anything
						continue
					else
						results.push index: i, suggestions: cached
				else
					if suggestions[key]?
						addToCache[key] = suggestions[key]
						results.push index: i, suggestions: suggestions[key]
					else
						# a valid word, but uncached
						addToCache[key] = true

			# update the cache after processing all words, to avoid cache
			# changing while we use it
			for k, v in addToCache
				cache.set(k, v)

			logger.log hits: hits, total: words.length, hitrate: hits/words.length, "cache hit rate"
			callback null, results

	getSuggestions: (language, output) ->
		lines = output.split("\n")
		suggestions = {}
		for line in lines
			if line[0] == "&" # Suggestions found
				parts = line.split(" ")
				if parts.length > 1
					word = parts[1]
					suggestionsString = line.slice(line.indexOf(":") + 2)
					suggestions[language + ":" + word] = suggestionsString.split(", ")
			else if line[0] == "#" # No suggestions
				parts = line.split(" ")
				if parts.length > 1
					word = parts[1]
					suggestions[language + ":" + word] = []
		return suggestions

	#removeAspellHeader: (output) -> output.slice(1)

	runAspellOnWords: (language, words, callback = (error, output) ->) ->
		# send words to aspell, get back string output for those words
		# find a free pipe for the language (or start one)
		# send the words down the pipe
		# send an END marker that will generate a "*" line in the output
		# when the output pipe receives the "*" return the data sofar and reset the pipe to be available
		#
		# @open(language)
		# @captureOutput(callback)
		# @setTerseMode()
		# start = new Date()

		newWord = {}
		for word in words
			newWord[word] = true if !newWord[word] && !cache.has(language + ':' + word)
		words = Object.keys(newWord)

		if words.length
			WorkerPool.check(language, words, ASpell.ASPELL_TIMEOUT, callback)
		else
			callback null, ""

module.exports = ASpell =
	# The description of how to call aspell from another program can be found here:
	# http://aspell.net/man-html/Through-A-Pipe.html
	checkWords: (language, words, callback = (error, result) ->) ->
		runner = new ASpellRunner()
		callback = _.once callback
		runner.checkWords language, words, callback
	ASPELL_TIMEOUT : 4000

WorkerPool = new ASpellWorkerPool()
