UserGetter = require '../User/UserGetter'
PlansLocator = require '../Subscription/PlansLocator'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'

module.exports = InstitutionsFeatures =
	getInstitutionsFeatures: (userId, callback = (error, features) ->) ->
		InstitutionsFeatures.hasLicence userId, (error, hasLicence) ->
			return callback error if error?
			return callback(null, {}) unless hasLicence
			plan = PlansLocator.findLocalPlanInSettings Settings.institutionPlanCode
			callback(null, plan?.features or {})


	hasLicence: (userId, callback = (error, hasLicence) ->) ->
		UserGetter.getUserFullEmails userId, (error, emailsData) ->
			return callback error if error?

			affiliation = emailsData.find (emailData) ->
				licence = emailData.affiliation?.institution?.licence
				emailData.confirmedAt? and licence? and licence != 'free'

			callback(null, !!affiliation)
