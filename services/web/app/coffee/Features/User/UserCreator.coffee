User = require("../../models/User").User
UserLocator = require("./UserLocator")
logger = require("logger-sharelatex")

module.exports =

	getUserOrCreateHoldingAccount: (email, callback = (err, user)->)->
		self = @
		UserLocator.findByEmail email, (err, user)->
			if user?
				callback(err, user)
			else
				self.createNewUser email:email, holdingAccount:true, callback

	createNewUser: (opts, callback)->
		logger.log opts:opts, "creating new user"
		user = new User()
		user.email = opts.email
		user.holdingAccount = opts.holdingAccount

		username = opts.email.match(/^[^@]*/)
		if opts.first_name? and opts.first_name.length != 0
			user.first_name = opts.first_name
		else if username?
			user.first_name = username[0]
		else
			user.first_name = ""

		if opts.last_name?
			user.last_name = opts.last_name
		else
			user.last_name = ""

		user.featureSwitches?.pdfng = true

		user.save (err)->
			callback(err, user)
