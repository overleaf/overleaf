ASpell = require './ASpell'
LearnedWordsManager = require './LearnedWordsManager'
async = require 'async'

module.exports = SpellingAPIManager =

	whitelist: [
		'ShareLaTeX',
		'sharelatex',
		'LaTeX',
		'http',
		'https',
		'www'
	]

	runRequest: (token, request, callback = (error, result) ->) ->
		if !request.words?
			return callback(new Error("malformed JSON"))

		lang = request.language || "en"

		check = (words, callback) ->
			ASpell.checkWords lang, words, (error, misspellings) ->
				callback error, misspellings: misspellings

		wordsToCheck = request.words || []

		if token?
			LearnedWordsManager.getLearnedWords token, (error, learnedWords) ->
				return callback(error) if error?
				words = (wordsToCheck).slice(0,10000)
				check words, (error, result) ->
					return callback error if error?
					result.misspellings = result.misspellings.filter (m) ->
						word = words[m.index]
						learnedWords.indexOf(word) == -1 and SpellingAPIManager.whitelist.indexOf(word) == -1
					callback error, result
		else
			check(wordsToCheck, callback)

	learnWord: (token, request, callback = (error) ->) ->
		if !request.word?
			return callback(new Error("malformed JSON"))
		if !token?
			return callback(new Error("no token provided"))

		LearnedWordsManager.learnWord token, request.word, callback

	deleteDic: (token, callback)->
		LearnedWordsManager.deleteUsersLearnedWords token, callback

	getDic: (token, callback)->
		LearnedWordsManager.getLearnedWords token, callback

