InstitutionsGetter = require './InstitutionsGetter'
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
		InstitutionsGetter.getConfirmedInstitutions userId, (error, institutions) ->
			return callback error if error?

			hasLicence = institutions.some (institution) ->
				institution.licence and institution.licence != 'free'

			callback(null, hasLicence)
