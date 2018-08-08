async = require('async')
logger = require 'logger-sharelatex'
Settings = require 'settings-sharelatex'
crypto = require('crypto')
Mailchimp = require('mailchimp-api-v3')

if !Settings.mailchimp?.api_key?
	logger.warn "No newsletter provider configured so not chaning email on user"
	mailchimp =
		request: (opts, cb)-> cb()
else
	mailchimp = new Mailchimp(Settings.mailchimp?.api_key)

module.exports =

	subscribe: (user, callback = () ->)->
		options = buildOptions(user, true)
		logger.log options:options, user:user, email:user.email, "trying to subscribe user to the mailing list"
		mailchimp.request options, (err)->
			if err?
				logger.err err:err, "error subscribing person to newsletter"
			else
				logger.log user:user, "finished subscribing user to the newsletter"
			callback(err)

	unsubscribe: (user, callback = () ->)->
		logger.log user:user, email:user.email, "trying to unsubscribe user to the mailing list"
		options = buildOptions(user, false)
		mailchimp.request options, (err)->
			if err?
				logger.err err:err, "error unsubscribing person to newsletter"
			else
				logger.log user:user, "finished unsubscribing user to the newsletter"
			callback(err)

	changeEmail: (oldEmail, newEmail, callback = ()->)->
		options = buildOptions({email:oldEmail})
		delete options.body.status
		options.body.email_address = newEmail
		mailchimp.request options, (err)->
			# if the user has unsubscribed mailchimp will error on email address change
			if err? and err?.message.indexOf("could not be validated") == -1
				logger.err err:err, "error changing email in newsletter"
				return callback(err)
			else
				logger.log "finished changing email in the newsletter"
				return callback()

hashEmail = (email)->
	crypto.createHash('md5').update(email.toLowerCase()).digest("hex")

buildOptions = (user, is_subscribed)->
	status =  if is_subscribed then "subscribed" else "unsubscribed"
	subscriber_hash = hashEmail(user.email)
	opts =
		method: "PUT"
		path: "/lists/#{Settings.mailchimp?.list_id}/members/#{subscriber_hash}"
		body:
			status_if_new: status
			status: status
			email_address:user.email
			merge_fields:
				FNAME: user.first_name
				LNAME: user.last_name
				MONGO_ID:user._id
	return opts

