logger = require("logger-sharelatex")
metrics = require("metrics-sharelatex")
settings = require "settings-sharelatex"
request = require "request"

module.exports = InstitutionsAPI =
	getInstitutionAffiliations: (institutionId, callback = (error, body) ->) ->
		makeAffiliationRequest {
			method: 'GET'
			path: "/api/v2/institutions/#{institutionId.toString()}/affiliations"
			defaultErrorMessage: "Couldn't get institution affiliations"
		}, (error, body) -> callback(error, body or [])


	getUserAffiliations: (userId, callback = (error, body) ->) ->
		makeAffiliationRequest {
			method: 'GET'
			path: "/api/v2/users/#{userId.toString()}/affiliations"
			defaultErrorMessage: "Couldn't get user affiliations"
		}, (error, body) -> callback(error, body or [])


	addAffiliation: (userId, email, affiliationOptions, callback) ->
		unless callback? # affiliationOptions is optional
			callback = affiliationOptions
			affiliationOptions = {}

		{ university, department, role, confirmedAt } = affiliationOptions
		makeAffiliationRequest {
			method: 'POST'
			path: "/api/v2/users/#{userId.toString()}/affiliations"
			body: { email, university, department, role, confirmedAt }
			defaultErrorMessage: "Couldn't create affiliation"
		}, callback


	removeAffiliation: (userId, email, callback = (error) ->) ->
		makeAffiliationRequest {
			method: 'POST'
			path: "/api/v2/users/#{userId.toString()}/affiliations/remove"
			body: { email }
			extraSuccessStatusCodes: [404] # `Not Found` responses are considered successful
			defaultErrorMessage: "Couldn't remove affiliation"
		}, callback


	endorseAffiliation: (userId, email, role, department, callback = (error) ->) ->
		makeAffiliationRequest {
			method: 'POST'
			path: "/api/v2/users/#{userId.toString()}/affiliations/endorse"
			body: { email, role, department }
			defaultErrorMessage: "Couldn't endorse affiliation"
		}, callback


	deleteAffiliations: (userId, callback = (error) ->) ->
		makeAffiliationRequest {
			method: 'DELETE'
			path: "/api/v2/users/#{userId.toString()}/affiliations"
			defaultErrorMessage: "Couldn't delete affiliations"
		}, callback


makeAffiliationRequest = (requestOptions, callback = (error) ->) ->
	return callback(null) unless settings?.apis?.v1?.url # service is not configured
	requestOptions.extraSuccessStatusCodes ||= []
	request {
		method: requestOptions.method
		url: "#{settings.apis.v1.url}#{requestOptions.path}"
		body: requestOptions.body
		auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
		json: true,
		timeout: 20 * 1000
	}, (error, response, body) ->
		return callback(error) if error?
		isSuccess = 200 <= response.statusCode < 300
		isSuccess ||= response.statusCode in requestOptions.extraSuccessStatusCodes
		unless isSuccess
			if body?.errors
				errorMessage = "#{response.statusCode}: #{body.errors}"
			else
				errorMessage = "#{requestOptions.defaultErrorMessage}: #{response.statusCode}"

			logger.err path: requestOptions.path, body: requestOptions.body, errorMessage
			return callback(new Error(errorMessage))

		callback(null, body)

[
	'getInstitutionAffiliations'
	'getUserAffiliations',
	'addAffiliation',
	'removeAffiliation',
].map (method) ->
	metrics.timeAsyncMethod(
		InstitutionsAPI, method, 'mongo.InstitutionsAPI', logger
	)
