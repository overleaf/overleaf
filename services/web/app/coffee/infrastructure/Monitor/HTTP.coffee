logger = require "logger-sharelatex"

module.exports.logger = (req, res, next) ->
	startTime = new Date()
	end = res.end
	res.end = () ->
		end.apply(this, arguments)
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
				"response-time": new Date() - startTime
			"http request"
	next()

