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
			metrics.inc "mongoCache", 0.1, {status: "hit"}
			return callback(null, mongoCachedWords)

		metrics.inc "mongoCache", 0.1, {status: "miss"}
		logger.info user_token:user_token, "mongoCache miss"
		
		db.spellingPreferences.findOne token: user_token, (error, preferences) ->
			return callback error if error?
			words = preferences?.learnedWords || []
			mongoCache.set(user_token, words)
			callback null, words

	deleteUsersLearnedWords: (user_token, callback =(error)->)->
		db.spellingPreferences.remove token: user_token, callback


[
	'learnWord',
	'getLearnedWords'
].map (method) ->
	metrics.timeAsyncMethod(LearnedWordsManager, method, 'mongo.LearnedWordsManager', logger)
