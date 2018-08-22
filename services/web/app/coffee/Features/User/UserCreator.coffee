User = require("../../models/User").User
logger = require("logger-sharelatex")
metrics = require('metrics-sharelatex')
{ addAffiliation } = require("../Institutions/InstitutionsAPI")


module.exports = UserCreator =

	createNewUser: (attributes, options, callback = (error, user) ->)->
		if arguments.length == 2
			callback = options
			options = {}
		logger.log user: attributes, "creating new user"
		user = new User()

		username = attributes.email.match(/^[^@]*/)
		if !attributes.first_name? or attributes.first_name == ""
			attributes.first_name = username[0]

		for key, value of attributes
			user[key] = value
			
		user.ace.syntaxValidation = true
		user.featureSwitches?.pdfng = true
		user.emails = [
			email: user.email
			createdAt: new Date()
		]

		user.save (err)->
			callback(err, user)

			return if options?.skip_affiliation
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
