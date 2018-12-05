os = require("os")

module.exports.monitor = (logger) ->
	return (req, res, next) ->
		Metrics = require("./metrics")
		startTime = new Date()
		end = res.end
		res.end = () ->
			end.apply(this, arguments)
			responseTime = new Date() - startTime
			if req.route?.path?
				routePath = req.route.path.toString().replace(/\//g, '_').replace(/\:/g, '').slice(1)
				Metrics.timing("http_request", responseTime, null, {method:req.method, status_code: res.statusCode, path:routePath})
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
						statusCode: res.statusCode
					"response-time": responseTime
					"http request"
					
		next()

