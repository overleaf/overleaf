logger = require('logger-sharelatex')
metrics = require('../../infrastructure/Metrics')
Settings = require('settings-sharelatex')
metrics = require("../../infrastructure/Metrics")
nodemailer = require("nodemailer")

if Settings.email? and Settings.email.fromAddress?
	defaultFromAddress = Settings.email.fromAddress
else
	defaultFromAddress = ""

# provide dummy mailer unless we have a better one configured.
client =
	sendMail: (options, callback = (err,status) ->) ->
		logger.log options:options, "Would send email if enabled."
		callback()

createSesClient = (settings) ->
	if settings? and settings.key? and settings.key != "" and settings.secret? and settings.secret != ""
		client = nodemailer.createTransport("SES", {AWSAccessKeyID: settings.key, AWSSecretKey: settings.secret} )
	else
		logger.warn "AWS SES credentials are not configured. No emails will be sent."

if Settings.email?
	switch Settings.email.transport
		when "ses"
			createSesClient( Settings.email.ses)
		# TODO direct, client
		when undefined,null,""
			logger.warn "No Email transport defined. No emails will be sent."
		else
			logger.warn "Uknown email transport #{Settings.email.transport}. No emails will be sent."

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
		client.sendMail options, (err, res)->
			if err?
				logger.err err:err, "error sending message"
			else
				logger.log "Message sent to #{options.to}"
			callback(err)

