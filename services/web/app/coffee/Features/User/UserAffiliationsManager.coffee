logger = require("logger-sharelatex")
metrics = require("metrics-sharelatex")
settings = require "settings-sharelatex"
request = require "request"

module.exports = UserAffiliationsManager =
	getAffiliations: (userId, callback = (error, body) ->) ->
		makeAffiliationRequest {
			method: 'GET'
			path: "/api/v2/users/#{userId.toString()}/affiliations"
			defaultErrorMessage: "Couldn't get affiliations"
		}, callback


	addAffiliation: (userId, email, { university, department, role }, callback = (error) ->) ->
		makeAffiliationRequest {
			method: 'POST'
			path: "/api/v2/users/#{userId.toString()}/affiliations"
			body: { email, university, department, role }
			defaultErrorMessage: "Couldn't create affiliation"
		}, callback


	removeAffiliation: (userId, email, callback = (error) ->) ->
		email = encodeURIComponent(email)
		makeAffiliationRequest {
			method: 'DELETE'
			path: "/api/v2/users/#{userId.toString()}/affiliations/#{email}"
			extraSuccessStatusCodes: [404] # `Not Found` responses are considered successful
			defaultErrorMessage: "Couldn't remove affiliation"
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
			return callback(new Error(errorMessage))

		callback(null, body)

[
	'getAffiliations',
	'addAffiliation',
	'removeAffiliation',
].map (method) ->
	metrics.timeAsyncMethod(
		UserAffiliationsManager, method, 'mongo.UserAffiliationsManager', logger
	)
