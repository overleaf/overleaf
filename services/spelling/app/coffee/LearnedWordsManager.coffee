db = require("./DB")
mongoCache = require("./MongoCache")
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')

module.exports = LearnedWordsManager =
	learnWord: (user_token, word, callback = (error)->) ->
		mongoCache.del(user_token)
		db.spellingPreferences.update {
			token: user_token
		}, {
			$push: learnedWords: word
		}, {
			upsert: true
		}, callback

	getLearnedWords: (user_token, callback = (error, words)->) ->
		mongoCachedWords = mongoCache.get(user_token)
		if mongoCachedWords?
			metrics.inc "mongoCache-hit", 0.1
			return callback(null, mongoCachedWords)

		metrics.inc "mongoCache-miss", 0.1
		logger.info user_token:user_token, "mongoCache miss"
		
		db.spellingPreferences.findOne token: user_token, (error, preferences) ->
			return callback error if error?
			words = preferences?.learnedWords || []
			mongoCache.set(user_token, words)
			callback null, words


metrics.timeAsyncMethod(
	LearnedWordsManager, 'learnWord',
	'LearnedWordsManager.learnWord',
	logger
)
metrics.timeAsyncMethod(
	LearnedWordsManager, 'getLearnedWords',
	'LearnedWordsManager.getLearnedWords',
	logger
)
