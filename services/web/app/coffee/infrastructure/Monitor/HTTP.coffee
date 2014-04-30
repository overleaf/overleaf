settings = require("settings-sharelatex")
logger = require "logger-sharelatex"
os = require("os")
metrics = require("../Metrics")

module.exports.logger = (req, res, next) ->
	startTime = new Date()
	end = res.end
	res.end = () ->
		end.apply(this, arguments)
		responseTime = new Date() - startTime
		routePath = req.route.path.toString().replace(/\//g, '-').slice(1)

		processName = if settings.internal.web.name? then "web-#{settings.internal.web.name}" else "web"
		key = "#{os.hostname()}.#{processName}.#{routePath}".toLowerCase().trim()
		metrics.timing(key, responseTime, 0.2)
		logger.log
			req:
				url: req.originalUrl || req.url
				method: req.method
				referrer: req.headers['referer'] || req.headers['referrer']
				"remote-addr": req.ip || req.socket?.socket?.remoteAddress || req.socket?.remoteAddress
				"user-agent": req.headers["user-agent"]
				"content-length": req.headers["content-length"]
			res:
				"content-length": res._headers?["content-length"]
				"response-time": responseTime
			"http request"
	next()

