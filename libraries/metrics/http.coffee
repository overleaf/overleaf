os = require("os")

module.exports.monitor = (logger) ->
	return (req, res, next) ->
		Metrics = require("./metrics")
		startTime = new Date()

		# only capture the properties of 'req' that we need, to avoid
		# leaking the whole req object for responses that never call
		# res.end()
		url = req.originalUrl || req.url
		method = req.method
		referrer = req.headers['referer'] || req.headers['referrer']
		remoteAddr = req.ip || req.socket?.socket?.remoteAddress || req.socket?.remoteAddress
		userAgent = req.headers["user-agent"]
		contentLength = req.headers["content-length"]
		path = req.route?.path

		end = res.end
		res.end = () ->
			end.apply(this, arguments)
			responseTime = new Date() - startTime
			if path?
				routePath = path.toString().replace(/\//g, '_').replace(/\:/g, '').slice(1)
				key = "http-requests.#{routePath}.#{method}.#{res.statusCode}"

				Metrics.timing(key, responseTime)
				logger.log
					req:
						url: url
						method: method
						referrer: referrer
						"remote-addr": remoteAddr
						"user-agent": userAgent
						"content-length": contentLength
					res:
						"content-length": res._headers?["content-length"]
						statusCode: res.statusCode
					"response-time": responseTime
					"http request"
					
		next()

