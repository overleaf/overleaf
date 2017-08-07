User = require("../../models/User").User
UserLocator = require("./UserLocator")
logger = require("logger-sharelatex")
metrics = require('metrics-sharelatex')


module.exports = UserCreator =

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

		username = opts.email.match(/^[^@]*/)
		if !opts.first_name? or opts.first_name == ""
			opts.first_name = username[0]

		for key, value of opts
			user[key] = value
			
		user.ace.syntaxValidation = true
		user.featureSwitches?.pdfng = true

		user.save (err)->
			callback(err, user)

metrics.timeAsyncMethod(
	UserCreator, 'createNewUser',
	'mongo.UserCreator',
	logger
)
