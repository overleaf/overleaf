User = require("../../models/User").User
logger = require("logger-sharelatex")
metrics = require('metrics-sharelatex')
{ addAffiliation } = require("./UserAffiliationsManager")


module.exports = UserCreator =

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
		user.emails = [
			email: user.email
			createdAt: new Date()
		]

		user.save (err)->
			callback(err, user)

			# call addaffiliation after the main callback so it runs in the
			# background. There is no guaranty this will run so we must no rely on it
			addAffiliation user._id, user.email, (error) ->
				if error
					logger.log { userId: user._id, email: user.email, error: error },
						"couldn't add affiliation for user on create"
				else
					logger.log { userId: user._id, email: user.email },
					"added affiliation for user on create"


metrics.timeAsyncMethod(
	UserCreator, 'createNewUser',
	'mongo.UserCreator',
	logger
)
