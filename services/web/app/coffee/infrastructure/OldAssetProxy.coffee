settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
request = require("request")

module.exports = (req, res, next)->
	requestedUrl = req.url

	redirectUrl = settings.proxyUrls[requestedUrl]
	if redirectUrl?
		logger.log redirectUrl:redirectUrl, reqUrl:req.url, "proxying url"
		upstream = request(redirectUrl)
		upstream.on "error", (error) ->
			logger.error err: error, "error in OldAssetProxy"
		upstream.pipe(res)
	else
		next()
