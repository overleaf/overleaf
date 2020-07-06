os = require("os")
yn = require("yn")

STACKDRIVER_LOGGING = yn(process.env['STACKDRIVER_LOGGING'])

module.exports.monitor = (logger) ->
	return (req, res, next) ->
		Metrics = require("./metrics")
		startTime = process.hrtime()
		end = res.end
		res.end = () ->
			end.apply(this, arguments)
			responseTime = process.hrtime(startTime)
			responseTimeMs = Math.round(responseTime[0] * 1000 + responseTime[1] / 1000000)
			requestSize = parseInt(req.headers["content-length"], 10)
			if req.route?.path?
				routePath = req.route.path.toString().replace(/\//g, '_').replace(/\:/g, '').slice(1)
				Metrics.timing("http_request", responseTimeMs, null, {method:req.method, status_code: res.statusCode, path:routePath})
				if requestSize
					Metrics.summary("http_request_size_bytes", requestSize, {method:req.method, status_code: res.statusCode, path:routePath})
			remoteIp = req.ip || req.socket?.socket?.remoteAddress || req.socket?.remoteAddress
			reqUrl = req.originalUrl || req.url
			referrer = req.headers['referer'] || req.headers['referrer']
			if STACKDRIVER_LOGGING
				info =
					httpRequest:
						requestMethod: req.method
						requestUrl: reqUrl
						requestSize: requestSize
						status: res.statusCode
						responseSize: res._headers?["content-length"]
						userAgent: req.headers["user-agent"]
						remoteIp: remoteIp
						referer: referrer
						latency:
							seconds: responseTime[0]
							nanos: responseTime[1]
						protocol: req.protocol
			else
				info =
					req:
						url: reqUrl
						method: req.method
						referrer: referrer
						"remote-addr": remoteIp
						"user-agent": req.headers["user-agent"]
						"content-length": req.headers["content-length"]
					res:
						"content-length": res._headers?["content-length"]
						statusCode: res.statusCode
					"response-time": responseTimeMs
			logger.info(info, "%s %s", req.method, reqUrl)
		next()
