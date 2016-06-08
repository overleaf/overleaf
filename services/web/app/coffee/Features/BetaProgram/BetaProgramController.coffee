BetaProgramHandler = require './BetaProgramHandler'
UserLocator = require "../User/UserLocator"
Settings = require "settings-sharelatex"
logger = require 'logger-sharelatex'


module.exports = BetaProgramController =

	optIn: (req, res, next) ->
		user_id = req?.session?.user?._id
		logger.log {user_id}, "user opting in to beta program"
		if !user_id
			return next(new Error("no user id in session"))
		BetaProgramHandler.optIn user_id, (err) ->
			if err
				return next(err)
			return res.redirect "/"

	optInPage: (req, res, next)->
		user_id = req.session?.user?._id
		logger.log {user_id}, "showing beta opt-in page for user"
		UserLocator.findById user_id, (err, user)->
			if err
				logger.err {err, user_id}, "error fetching user"
				return next(err)
			res.render 'beta_program/opt_in',
				title:'sharelatex_beta_program'
				user: user,
				languages: Settings.languages,
