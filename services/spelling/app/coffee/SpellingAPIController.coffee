SpellingAPIManager = require './SpellingAPIManager'
restify = require 'restify'
logger = require 'logger-sharelatex'
metrics = require('./Metrics')

module.exports = SpellingAPIController =
	check: (req, res, next) ->
		metrics.inc "spelling-check", 0.1
		if req.is("json")
			logger.log token: req?.params?.user_id, word_count: req?.body?.words?.length, "running check"
			SpellingAPIManager.runRequest req.params.user_id, req.body, (error, result) ->
				if err?
					logger.err err:err, user_id:req?.params?.user_id, word_count: req?.body?.words?.length, "error processing spelling request"
					return res.send(500)
				res.send(result)
		else
			next(new restify.NotAcceptableError("Please provide a JSON request"))

	learn: (req, res, next) ->
		metrics.inc "spelling-learn", 0.1
		if req.is("json")
			logger.log token: req?.params?.user_id, word: req?.body?.word, "learning word"
			SpellingAPIManager.learnWord req.params.user_id, req.body, (error, result) ->
				return next(error) if error?
				res.send(200)
				next()
		else
			next(new restify.NotAcceptableError("Please provide a JSON request"))



