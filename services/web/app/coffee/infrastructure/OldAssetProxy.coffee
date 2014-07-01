settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
request = require("request")

module.exports = (req, res, next)->
	requestedUrl = req.url

	redirectUrl = settings.proxyUrls[requestedUrl]
	if redirectUrl?
		logger.log redirectUrl:redirectUrl, reqUrl:req.url, "proxying url"
		request(redirectUrl).pipe(res)
	else
		next()
