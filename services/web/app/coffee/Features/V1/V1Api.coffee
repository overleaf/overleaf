request = require 'request'
settings = require 'settings-sharelatex'
Errors = require '../Errors/Errors'

# TODO: check what happens when these settings aren't defined
DEFAULT_V1_PARAMS = {
	baseUrl: settings?.apis?.v1?.url
	auth:
		user: settings?.apis?.v1?.user
		pass: settings?.apis?.v1?.pass
	json: true,
	timeout: 30 * 1000
}

v1Request = request.defaults(DEFAULT_V1_PARAMS)

DEFAULT_V1_OAUTH_PARAMS = {
	baseUrl: settings?.apis?.v1?.url
	json: true,
	timeout: 30 * 1000
}

v1OauthRequest = request.defaults(DEFAULT_V1_OAUTH_PARAMS)

module.exports = V1Api =
	request: (options, callback) ->
		return request(options) if !callback?
		v1Request options, (error, response, body) ->
			V1Api._responseHandler options, error, response, body, callback

	oauthRequest: (options, token, callback) ->
		return callback(new Error "uri required") unless options.uri?
		options.method = "GET" unless options.method?
		options.auth = bearer: token
		v1OauthRequest options, (error, response, body) ->
			V1Api._responseHandler options, error, response, body, callback

	_responseHandler: (options, error, response, body, callback) ->
			return callback(error, response, body) if error?
			if 200 <= response.statusCode < 300 or response.statusCode in (options.expectedStatusCodes or [])
				callback null, response, body
			else if response.statusCode == 403
				error = new Errors.ForbiddenError("overleaf v1 returned forbidden")
				error.statusCode = response.statusCode
				callback error
			else
				error = new Error("overleaf v1 returned non-success code: #{response.statusCode} #{options.method} #{options.uri}")
				error.statusCode = response.statusCode
				callback error
