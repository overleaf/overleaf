settings = require("settings-sharelatex")
EmailBuilder = require "./EmailBuilder"
EmailSender = require "./EmailSender"

if !settings.email?
	settings.email =
		lifecycleEnabled:false


module.exports =

	sendEmail : (emailType, opts, callback = (err)->)->
		email = EmailBuilder.buildEmail emailType, opts
		if email.type == "lifecycle" and !settings.email.lifecycle
			return callback()
		opts.html = email.html
		opts.text = email.text
		opts.subject = email.subject
		EmailSender.sendEmail opts, (err)->
			callback(err)
