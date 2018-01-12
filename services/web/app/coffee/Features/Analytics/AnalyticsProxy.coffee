settings = require "settings-sharelatex"
Errors = require '../Errors/Errors'
httpProxy = require 'express-http-proxy'
URL = require 'url'

module.exports =
	call: (basePath) ->
		analyticsUrl = settings?.apis?.analytics?.url
		if analyticsUrl?
			httpProxy(analyticsUrl,
				proxyReqPathResolver: (req) ->
					requestPath = URL.parse(req.url).path
					"#{basePath}#{requestPath}"
				proxyReqOptDecorator: (proxyReqOpts, srcReq) ->
					proxyReqOpts.headers = {} # unset all headers
					proxyReqOpts
			)
		else
			(req, res, next) ->
				next(new Errors.ServiceNotConfiguredError('Analytics service not configured'))
