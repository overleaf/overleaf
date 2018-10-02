request = require 'request'
settings = require 'settings-sharelatex'

# TODO: check what happens when these settings aren't defined
DEFAULT_V1_PARAMS = {
	baseUrl: settings?.apis?.v1?.url
	auth:
		user: settings?.apis?.v1?.user
		pass: settings?.apis?.v1?.pass
	json: true,
	timeout: 30 * 1000
}

request = request.defaults(DEFAULT_V1_PARAMS)

module.exports = V1Api =
	request: (options, callback) ->
		return request(options) if !callback?
		request options, (error, response, body) ->
			return callback(error, response, body) if error?
			if 200 <= response.statusCode < 300 or response.statusCode in (options.expectedStatusCodes or [])
				callback null, response, body
			else
				error = new Error("overleaf v1 returned non-success code: #{response.statusCode}")
				error.statusCode = response.statusCode
				callback error
