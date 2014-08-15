ASpell = require './ASpell'
LearnedWordsManager = require './LearnedWordsManager'
async = require 'async'

module.exports = SpellingAPIManager =
	runRequest: (token, request, callback = (error, result) ->) ->
		if !request.words?
			return callback(new Error("malformed JSON"))
	
		lang = request.language || "en"

		check = (words, callback) ->
			ASpell.checkWords lang, words, (error, misspellings) ->
				callback error, misspellings: misspellings
		
		if token?
			LearnedWordsManager.getLearnedWords token, (error, learnedWords) ->
				return callback(error) if error?
				words = (request.words || []).slice(0,10000)
				check words, (error, result) ->
					return callback error if error?
					result.misspellings = result.misspellings.filter (m) ->
						word = words[m.index]
						learnedWords.indexOf(word) == -1
					callback error, result
		else
			check(request.words, callback)

	learnWord: (token, request, callback = (error) ->) ->
		if !request.word?
			return callback(new Error("malformed JSON"))
		if !token?
			return callback(new Error("no token provided"))

		LearnedWordsManager.learnWord token, request.word, callback


