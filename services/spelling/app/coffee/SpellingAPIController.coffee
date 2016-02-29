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
			# res.send(result)
			res.writeHead 200

	learn: (req, res, next) ->
		metrics.inc "spelling-learn", 0.1
		logger.log token: req?.params?.user_id, word: req?.body?.word, "learning word"
		SpellingAPIManager.learnWord req.params.user_id, req.body, (error, result) ->
			return next(error) if error?
			res.sendStatus(200)
			next()


