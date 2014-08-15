db = require("./DB")

module.exports = LearnedWordsManager =
	learnWord: (user_token, word, callback = (error)->) ->
		db.spellingPreferences.update {
			token: user_token
		}, {
			$push: learnedWords: word
		}, {
			upsert: true
		}, callback

	getLearnedWords: (user_token, callback = (error, words)->) ->
		db.spellingPreferences.findOne token: user_token, (error, preferences) ->
			return callback error if error?
			callback null, (preferences?.learnedWords || [])

		
