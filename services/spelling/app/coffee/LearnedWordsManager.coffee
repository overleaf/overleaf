db = require("./DB")
LRU = require("lru-cache")
cacheOpts = 
	max: 5000
	maxAge: 1000 * 60 * 60

cache = LRU(cacheOpts)
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')



module.exports = LearnedWordsManager =
	learnWord: (user_token, word, callback = (error)->) ->
		cache.del(user_token)
		db.spellingPreferences.update {
			token: user_token
		}, {
			$push: learnedWords: word
		}, {
			upsert: true
		}, callback

	getLearnedWords: (user_token, callback = (error, words)->) ->
		cachedWords = cache.get(user_token)
		if cachedWords
			logger.info user_token:user_token, "cache hit"
			metrics.inc "cache-hit", 0.1
			return callback(null, cachedWords)

		metrics.inc "cache-miss", 0.1
		logger.info user_token:user_token, "cache miss"
		
		db.spellingPreferences.findOne token: user_token, (error, preferences) ->
			return callback error if error?
			words = preferences?.learnedWords || []
			cache.set(user_token, words)
			callback null, words

		
