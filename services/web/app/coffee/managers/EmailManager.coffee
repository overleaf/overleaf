logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
Path = require "path"
_ = require('underscore')
metrics = require('../infrastructure/Metrics')
fs = require("fs")

if Settings.ses?.key? and Settings.ses?.key != "" and Settings.ses?.secret? and Settings.ses?.secret != ""
	ses = require('node-ses')
	client = ses.createClient({ key: Settings.ses.key, secret: Settings.ses.secret });
else
	logger.warn "AWS SES credentials are not configured. No emails will be sent."
	client =
		sendemail: (options, callback = (err, data, res) ->) ->
			logger.log options: options, "would send email if SES credentials enabled"
			callback()

module.exports =
	sendEmail : (options, callback = (error) ->)->
		logger.log options:options, "sending email"
		metrics.inc "email"
		template = options.template_name || "emailTemplate"
		fs.readFile Path.resolve(__dirname + "/../../templates/email/#{template}.html"), (err, htmlTemplate)->
			logger.error err: err, "error sending email" if err?
			return callback(err) if err?
			compiledTemplate = _.template htmlTemplate.toString()
			htmlMessage = compiledTemplate
				previewMessage : options.subject
				heading : options.heading
				message: options.message
				view_data:options.view_data
			options = 
				to: options.receiver
				from: "ShareLaTeX <team@sharelatex.com>"
				subject: options.subject
				message: htmlMessage
				replyTo: options.replyTo || "team@sharelatex.com"
			client.sendemail options, (err, data, res)->
				return callback(err) if err?
				if err?
					logger.log "error sending message"
				else
					logger.log "Message sent to #{options.to}"
				callback()
	
