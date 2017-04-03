metrics = require('metrics-sharelatex')
module.exports =
	log: (req)->
		if req.headers["user-agent"]?
			userAgent = req.headers["user-agent"].toLowerCase()
			if userAgent.indexOf("google") != -1
				metrics.inc "crawler.google"
			else if userAgent.indexOf("facebook") != -1
				metrics.inc "crawler.facebook"
			else if userAgent.indexOf("bing") != -1
				metrics.inc "crawler.bing"
