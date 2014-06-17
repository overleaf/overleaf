async = require('async')
Request = require('request')
logger = require 'logger-sharelatex'
Settings = require 'settings-sharelatex'

module.exports =
	subscribe: (user, callback = () ->)->
		if !Settings.markdownmail?
			logger.warn "No newsletter provider configured so not subscribing user"
			return callback()
		logger.log user:user, email:user.email, "trying to subscribe user to the mailing list"
		options = buildOptions(user, true)
		Request.post options, (err, response, body)->
			logger.log body:body, user:user, "finished attempting to subscribe the user to the news letter"
			callback(err)

	unsubscribe: (user, callback = () ->)->
		if !Settings.markdownmail?
			logger.warn "No newsletter provider configured so not unsubscribing user"
			return callback()
		logger.log user:user, email:user.email, "trying to unsubscribe user to the mailing list"
		options = buildOptions(user, false)
		Request.post options, (err, response, body)->
			logger.log err:err, body:body, email:user.email, "compled newsletter unsubscribe attempt"
			callback(err)

buildOptions = (user, is_subscribed)->
	options =
		json:
			secret_token: Settings.markdownmail.secret 
			name: "#{user.first_name} #{user.last_name}"
			email: user.email
			subscriber_list_id: Settings.markdownmail.list_id
			is_subscribed: is_subscribed
		url: "https://www.markdownmail.io/lists/subscribe"
		timeout: 30 * 1000
	return options