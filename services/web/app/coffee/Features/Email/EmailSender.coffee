logger = require('logger-sharelatex')
metrics = require('../../infrastructure/Metrics')
Settings = require('settings-sharelatex')
metrics = require("../../infrastructure/Metrics")
ses = require('node-ses')

if Settings.ses?.key? and Settings.ses?.key != "" and Settings.ses?.secret? and Settings.ses?.secret != ""
	client = ses.createClient({ key: Settings.ses.key, secret: Settings.ses.secret });
else
	logger.warn "AWS SES credentials are not configured. No emails will be sent."
	client =
		sendemail: (options, callback = (err, data, res) ->) ->
			logger.log options: options, "would send email if SES credentials enabled"
			callback()

module.exports =

	sendEmail : (options, callback = (error) ->)->
		logger.log receiver:options.receiver, subject:options.subject, "sending email"
		metrics.inc "email"
		options = 
			to: options.to
			from: "ShareLaTeX <team@sharelatex.com>"
			subject: options.subject
			message: options.html
			replyTo: options.replyTo || "team@sharelatex.com"
		client.sendemail options, (err, data, res)->
			if err?
				logger.err err:err, "error sending message"
			else
				logger.log "Message sent to #{options.to}"
			callback(err)
	