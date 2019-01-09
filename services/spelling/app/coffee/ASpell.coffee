async = require "async"
ASpellWorkerPool = require "./ASpellWorkerPool"
LRU = require "lru-cache"
logger = require 'logger-sharelatex'
fs = require 'fs'
settings = require("settings-sharelatex")
Path = require("path")

cache = LRU(10000)
OneMinute = 60 * 1000

cacheFsPath = Path.resolve(settings.cacheDir, "spell.cache")
cacheFsPathTmp = cacheFsPath + ".tmp"

# load any existing cache
try
	oldCache = fs.readFileSync cacheFsPath
	cache.load JSON.parse(oldCache)
catch err
	logger.log err:err, cacheFsPath:cacheFsPath, "could not load the cache file"

# write the cache every 30 minutes
setInterval () ->
	dump = JSON.stringify cache.dump()
	fs.writeFile cacheFsPathTmp, dump, (err) ->
		if err?
			logger.log {err}, "error writing cache file"
			fs.unlink cacheFsPathTmp
		else
			fs.rename cacheFsPathTmp, cacheFsPath
			logger.log {len: dump.length, cacheFsPath:cacheFsPath}, "wrote cache file"
, 30 * OneMinute

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
			for k, v of addToCache
				cache.set(k, v)

			logger.info hits: hits, total: words.length, hitrate: (hits/words.length).toFixed(2), "cache hit rate"
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
		runner.checkWords language, words, callback
	ASPELL_TIMEOUT : 4000

WorkerPool = new ASpellWorkerPool()
