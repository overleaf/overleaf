logger = require("logger-sharelatex")
settings = require "settings-sharelatex"
{User} = require "../../models/User"
UserCreator = require "../User/UserCreator"
AuthenticationController = require "./AuthenticationController"

passport = require "passport"

module.exports = OverleafAuthenticationController =
	passportLogin: passport.authenticate("oauth2")
	
	passportCallback: passport.authenticate("oauth2")
	
	afterPassportLogin: (req, res, next) ->
		logger.log {user: req.user}, "successful log in!"
		AuthenticationController.afterLoginSessionSetup req, req.user, (err) ->
			return next(err) if err?
			res.redirect("/")

	doPassportLogin: (accessToken, refreshToken, profile, cb) ->
		logger.log {accessToken, refreshToken, profile}, "authing user via overleaf oauth"
		OverleafAuthenticationController._findOrCreateUser profile, (err, user) ->
			return cb(err) if err?
			user.overleaf.accessToken = accessToken
			user.save (err) ->
				return cb(err) if err?
				return cb(null, user)
		
	_findOrCreateUser: (profile, cb) ->
		User.findOne { "overleaf.id": profile.id }, (err, user) ->
			return cb(err) if err?
			return cb(null, user) if user?
			UserCreator.createNewUser { overleaf: { id: profile.id }, email: profile.email }, cb
