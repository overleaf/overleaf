settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
httpProxy = require 'express-http-proxy'

module.exports = 
	# add proxy for all paths listed in `settings.proxyUrls`and log errors
	apply: (app) ->
		for requestUrl, target of settings.proxyUrls
			targetUrl = @makeTargetUrl(target)
			if targetUrl?
				app.use requestUrl, httpProxy(targetUrl)
			else
				logger.error "Cannot make proxy target from #{target}"

	# takes a 'target' and return an URL to proxy to.
	# 'target' can be:
	# - a String, representing the URL
	# - an Object with:
	#   - a path attribute (String)
	#   - a baseURL attribute (String)
	makeTargetUrl: (target) ->
		return target if typeof target is 'string'
		return target.path unless target.baseUrl?
		"#{target.baseUrl}#{target.path or ''}"

