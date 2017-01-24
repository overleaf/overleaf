request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
_ = require("underscore")
ErrorController = require "../Errors/ErrorController"

module.exports = BlogController = 

	getPage: (req, res, next)->
		url = req.url?.toLowerCase()
		blogUrl = "#{settings.apis.blog.url}#{url}"

		extensionsToProxy = [".png", ".xml", ".jpeg", ".json", ".zip", ".eps", ".gif"]

		shouldProxy = _.find extensionsToProxy, (extension)->
			url.indexOf(extension) != -1

		if shouldProxy
			return BlogController._directProxy blogUrl, res

		logger.log url:url, "proxying request to blog api"
		request.get blogUrl, (err, r, data)->
			if r?.statusCode == 404 or r?.statusCode == 403
				return ErrorController.notFound(req, res, next)
			if err?
				return res.send 500
			data = data.trim()
			try
				data = JSON.parse(data)
				if settings.cdn?.web?.host?
					data?.content = data?.content?.replace(/src="(\/[^"]+)"/g, "src='#{settings.cdn?.web?.host}$1'");
			catch err
				logger.err err:err, data:data, "error parsing data from data"
			res.render "blog/blog_holder", data


	getIndexPage: (req, res)->
		req.url = "/blog/index.html"
		BlogController.getPage req, res

	_directProxy: (originUrl, res)->
		upstream = request.get(originUrl)
		upstream.on "error", (error) ->
			logger.error err: error, "blog proxy error"
		upstream.pipe res