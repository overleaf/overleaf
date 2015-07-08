request = require 'request'
Settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'

module.exports = SpellingController =
	proxyRequestToSpellingApi: (req, res, next) ->
		url = req.url.slice("/spelling".length)
		url = "/user/#{req.session.user._id}#{url}"
		req.headers["Host"] = Settings.apis.spelling.host
		getReq = request(url: Settings.apis.spelling.url + url, method: req.method, headers: req.headers, json: req.body)
		getReq.pipe(res)
		getReq.on "error", (error) ->
			logger.error err: error, "Spelling API error"
			res.sendStatus 500
