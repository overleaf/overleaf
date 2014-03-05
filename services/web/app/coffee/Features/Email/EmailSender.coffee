logger = require('logger-sharelatex')
metrics = require('../../infrastructure/Metrics')
Settings = require('settings-sharelatex')
metrics = require("../../infrastructure/Metrics")
ses = require('node-ses')

if Settings.email? and Settings.email.fromAddress?
	defaultFromAddress = Settings.email.fromAddress
else 
	defaultFromAddress = ""

if Settings.email?.ses? and Settings.email.ses?.key? and Settings.email.ses?.key != "" and Settings.email.ses?.secret? and Settings.email.ses?.secret != ""
	client = ses.createClient({ key: Settings.email.ses.key, secret: Settings.email.ses.secret });
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
			from: defaultFromAddress
			subject: options.subject
			message: options.html
			replyTo: options.replyTo || Settings.email.replyToAddress
		client.sendemail options, (err, data, res)->
			if err?
				logger.err err:err, "error sending message"
			else
				logger.log "Message sent to #{options.to}"
			callback(err)
	