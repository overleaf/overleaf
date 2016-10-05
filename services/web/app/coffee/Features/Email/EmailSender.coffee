logger = require('logger-sharelatex')
metrics = require('../../infrastructure/Metrics')
Settings = require('settings-sharelatex')
nodemailer = require("nodemailer")
sesTransport = require('nodemailer-ses-transport')
sgTransport = require('nodemailer-sendgrid-transport')

_ = require("underscore")

if Settings.email? and Settings.email.fromAddress?
	defaultFromAddress = Settings.email.fromAddress
else
	defaultFromAddress = ""

# provide dummy mailer unless we have a better one configured.
client =
	sendMail: (options, callback = (err,status) ->) ->
		logger.log options:options, "Would send email if enabled."
		callback()

if Settings?.email?.parameters?.AWSAccessKeyID?
	logger.log "using aws ses for email"
	nm_client = nodemailer.createTransport(sesTransport(Settings.email.parameters))
else if Settings?.email?.parameters?.sendgridApiKey?
	logger.log "using sendgrid for email"
	nm_client = nodemailer.createTransport(sgTransport({auth:{api_key:Settings?.email?.parameters?.sendgridApiKey}}))
else if Settings?.email?.parameters?
	smtp = _.pick(Settings?.email?.parameters, "host", "port", "secure", "auth")


	logger.log "using smtp for email"
	nm_client = nodemailer.createTransport(smtp)
else
	nm_client = client
	logger.warn "Email transport and/or parameters not defined. No emails will be sent."

if nm_client?
		client = nm_client
else
	logger.warn "Failed to create email transport. Please check your settings. No email will be sent."


module.exports =
	sendEmail : (options, callback = (error) ->)->
		logger.log receiver:options.to, subject:options.subject, "sending email"
		metrics.inc "email"
		options =
			to: options.to
			from: defaultFromAddress
			subject: options.subject
			html: options.html
			text: options.text
			replyTo: options.replyTo || Settings.email.replyToAddress
			socketTimeout: 30 * 1000
		client.sendMail options, (err, res)->
			if err?
				logger.err err:err, "error sending message"
			else
				logger.log "Message sent to #{options.to}"
			callback(err)
