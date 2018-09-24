InstitutionsGetter = require './InstitutionsGetter'
PlansLocator = require '../Subscription/PlansLocator'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'

module.exports = InstitutionsFeatures =
	getInstitutionsFeatures: (userId, callback = (error, features) ->) ->
		InstitutionsFeatures.getInstitutionsPlan userId, (error, plan) ->
			return callback error if error?
			plan = PlansLocator.findLocalPlanInSettings plan
			callback(null, plan?.features or {})


	getInstitutionsPlan: (userId, callback = (error, plan) ->) ->
		InstitutionsFeatures.hasLicence userId, (error, hasLicence) ->
			return callback error if error?
			return callback(null, null) unless hasLicence
			callback(null, Settings.institutionPlanCode)


	hasLicence: (userId, callback = (error, hasLicence) ->) ->
		InstitutionsGetter.getConfirmedInstitutions userId, (error, institutions) ->
			return callback error if error?

			hasLicence = institutions.some (institution) ->
				institution.licence and institution.licence != 'free'

			callback(null, hasLicence)
