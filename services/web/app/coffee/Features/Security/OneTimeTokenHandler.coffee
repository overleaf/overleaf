Settings = require('settings-sharelatex')
crypto = require("crypto")
logger = require("logger-sharelatex")
{db} = require "../../infrastructure/mongojs"
Errors = require "../Errors/Errors"

ONE_HOUR_IN_S = 60 * 60

module.exports =
	getNewToken: (use, data, options = {}, callback = (error, data) ->)->
		# options is optional
		if typeof options == "function"
			callback = options
			options = {}
		expiresIn = options.expiresIn or ONE_HOUR_IN_S
		createdAt = new Date()
		expiresAt = new Date(createdAt.getTime() + expiresIn * 1000)
		token = crypto.randomBytes(32).toString("hex")
		logger.log {data, expiresIn, token_start: token.slice(0,8)}, "generating token for #{use}"
		db.tokens.insert {
			use: use
			token: token,
			data: data,
			createdAt: createdAt,
			expiresAt: expiresAt
		}, (error) ->
			return callback(error) if error?
			callback null, token

	findValidTokenFromData: (use, data, callback = (error, token) ->) ->
		db.tokens.findOne {
			use: use,
			data: data,
			expiresAt: { $gt: new Date() },
			usedAt: { $exists: false }
		}, (error, token) ->
			return callback(error) if error?
			return callback null, token?.token

	getValueFromTokenAndExpire: (use, token, callback = (error, data) ->)->
		logger.log token_start: token.slice(0,8), "getting data from #{use} token"
		now = new Date()
		db.tokens.findAndModify {
			query: {
				use: use,
				token: token,
				expiresAt: { $gt: now },
				usedAt: { $exists: false }
			},
			update: {
				$set: {
					usedAt: now
				}
			}
		}, (error, token) ->
			return callback(error) if error?
			if !token?
				return callback(new Errors.NotFoundError('no token found'))
			return callback null, token.data

