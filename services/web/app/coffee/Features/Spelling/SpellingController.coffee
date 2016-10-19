request = require 'request'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
AuthenticationController = require('../Authentication/AuthenticationController')

TEN_SECONDS = 1000 * 10

module.exports = SpellingController =
	proxyRequestToSpellingApi: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId(req)
		url = req.url.slice("/spelling".length)
		url = "/user/#{user_id}#{url}"
		req.headers["Host"] = Settings.apis.spelling.host
		request(url: Settings.apis.spelling.url + url, method: req.method, headers: req.headers, json: req.body, timeout:TEN_SECONDS)
		.on "error", (error) ->
			logger.error err: error, "Spelling API error"
			res.status(500).end()
		.pipe(res)
