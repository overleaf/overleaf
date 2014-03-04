EmailTemplator = require "./EmailTemplator"
EmailSender = require "./EmailSender"

module.exports =

	sendEmail : (emailType, opts, callback)->
		email = EmailTemplator.buildEmail emailType, opts
		opts.html = email.html
		opts.subject = email.subject
		EmailSender.sendEmail opts, (err)->
			callback(err)

# module.exports.sendEmail "welcome", {first_name:"henry", to:"henry.oswald@gmail.com"}, ->

