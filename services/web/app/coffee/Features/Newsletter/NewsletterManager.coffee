async = require('async')
logger = require 'logger-sharelatex'
Settings = require 'settings-sharelatex'
crypto = require('crypto')
Mailchimp = require('mailchimp-api-v3')

if !Settings.mailchimp?.api_key?
	logger.info "Using newsletter provider: none"
	mailchimp =
		request: (opts, cb)-> cb()
else
	logger.info "Using newsletter provider: mailchimp"
	mailchimp = new Mailchimp(Settings.mailchimp?.api_key)

module.exports =

	subscribe: (user, callback = () ->)->
		options = buildOptions(user, true)
		logger.log options:options, user:user, email:user.email, "subscribing user to the mailing list"
		mailchimp.request options, (err)->
			if err?
				logger.err err:err, user:user, "error subscribing person to newsletter"
			else
				logger.log user:user, "finished subscribing user to the newsletter"
			callback(err)

	unsubscribe: (user, callback = () ->)->
		logger.log user:user, email:user.email, "trying to unsubscribe user to the mailing list"
		options = buildOptions(user, false)
		mailchimp.request options, (err)->
			if err?
				logger.err err:err, user:user, "error unsubscribing person to newsletter"
			else
				logger.log user:user, "finished unsubscribing user to the newsletter"
			callback(err)

	changeEmail: (oldEmail, newEmail, callback = ()->)->
		options = buildOptions({email:oldEmail})
		delete options.body.status
		options.body.email_address = newEmail
		mailchimp.request options, (err)->
			if err? and err?.message?.indexOf("merge fields were invalid") != -1
				logger.log {oldEmail, newEmail}, "unable to change email in newsletter, user has never subscribed"
				return callback()
			else if err? and err?.message?.indexOf("could not be validated") != -1
				logger.log {oldEmail, newEmail}, 
					"unable to change email in newsletter, user has previously unsubscribed or new email already exist on list"
				return callback(err)
			else if err?
				logger.err {err, oldEmail, newEmail}, "error changing email in newsletter"
				return callback(err)
			else
				logger.log "finished changing email in the newsletter"
				return callback()

hashEmail = (email)->
	crypto.createHash('md5').update(email.toLowerCase()).digest("hex")

buildOptions = (user, is_subscribed)->
	subscriber_hash = hashEmail(user.email)
	opts =
		method: "PUT"
		path: "/lists/#{Settings.mailchimp?.list_id}/members/#{subscriber_hash}"
		body:
			email_address:user.email
				
	status = if is_subscribed then "subscribed" else "unsubscribed"
	if is_subscribed?
		opts.body.status = status
		opts.body.status_if_new = status

	if user._id?
		opts.body.merge_fields = 
			FNAME: user.first_name
			LNAME: user.last_name
			MONGO_ID:user._id

	console.log opts
	return opts

