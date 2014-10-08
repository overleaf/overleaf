request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
_ = require("underscore")
ErrorController = require "../Errors/ErrorController"

extensionsToProxy = [".png", ".xml", ".jpeg", ".json", ".zip", ".eps"]

module.exports = BlogController = 

	getPage: (req, res, next)->
		url = req.url?.toLowerCase()
		blogUrl = "#{settings.apis.blog.url}#{url}"

		extensionsToProxy = [".png", ".xml", ".jpeg", ".json", ".zip", ".eps"]

		shouldProxy = _.find extensionsToProxy, (extension)->
			url.indexOf(extension) != -1

		if shouldProxy
			return BlogController._directProxy blogUrl, res

		logger.log url:url, "proxying request to blog api"
		request.get blogUrl, (err, r, data)->
			if r?.statusCode == 404
				return ErrorController.notFound(req, res, next)
			data = data.trim()
			try
				data = JSON.parse(data)
			catch err
				logger.err err:err, data:data, "error parsing data from data"
			res.render "blog/blog_holder", data


	getIndexPage: (req, res)->
		req.url = "/blog/index.html"
		BlogController.getPage req, res

	_directProxy: (originUrl, res)->
		request.get(originUrl).pipe res