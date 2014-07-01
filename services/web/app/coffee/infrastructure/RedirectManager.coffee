settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports = (req, res, next)->
	
	requestedUrl = req.url

	redirectUrl = settings.redirects[requestedUrl]

	#remove starting slash
	if !redirectUrl? and requestedUrl[requestedUrl.length-1] == "/"
		requestedUrl = requestedUrl.substring(0, requestedUrl.length - 1)
		redirectUrl = settings.redirects[requestedUrl]

	if redirectUrl?
		logger.log redirectUrl:redirectUrl, reqUrl:req.url, "redirecting to new path"
		res.redirect 301, "#{redirectUrl}"
	else
		next()

