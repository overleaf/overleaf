SpellingAPIManager = require './SpellingAPIManager'
logger = require 'logger-sharelatex'
metrics = require('metrics-sharelatex')

module.exports = SpellingAPIController =
	check: (req, res, next) ->
		metrics.inc "spelling-check", 0.1
		logger.log token: req?.params?.user_id, word_count: req?.body?.words?.length, "running check"
		SpellingAPIManager.runRequest req.params.user_id, req.body, (error, result) ->
			if error?
				logger.err err:error, user_id:req?.params?.user_id, word_count: req?.body?.words?.length, "error processing spelling request"
				return res.sendStatus(500)
			res.send(result)

	learn: (req, res, next) ->
		metrics.inc "spelling-learn", 0.1
		logger.log token: req?.params?.user_id, word: req?.body?.word, "learning word"
		SpellingAPIManager.learnWord req.params.user_id, req.body, (error, result) ->
			return next(error) if error?
			res.sendStatus(200)
			next()


	deleteDic: (req, res, next)->
		logger.log token: req?.params?.user_id, word: req?.body?.word, "deleting user dictionary"
		SpellingAPIManager.deleteDic req.params.user_id, (error) ->
			return next(error) if error?
			res.sendStatus(204)


	getDic: (req, res, next)->
		logger.info token: req?.params?.user_id, "getting user dictionary"
		SpellingAPIManager.getDic req.params.user_id, (error, words)->
			return next(error) if error?
			res.send(words)