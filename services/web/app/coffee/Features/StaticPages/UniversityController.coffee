request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
_ = require("underscore")
ErrorController = require "../Errors/ErrorController"
StaticPageHelpers = require("./StaticPageHelpers")

module.exports = UniversityController = 

	getPage: (req, res, next)->
		url = req.url?.toLowerCase()
		universityUrl = "#{settings.apis.university.url}#{url}"
		console.log universityUrl
		if StaticPageHelpers.shouldProxy(url) 
			return UniversityController._directProxy universityUrl, res

		logger.log url:url, "proxying request to university api"
		request.get universityUrl, (err, r, data)->
			if r?.statusCode == 404
				return ErrorController.notFound(req, res, next)
			data = data.trim()
			try
				data = JSON.parse(data)
			catch err
				logger.err err:err, data:data, "error parsing data from data"
			res.render "university/university_holder", data


	getIndexPage: (req, res)->
		req.url = "/university/index.html"
		UniversityController.getPage req, res

	_directProxy: (originUrl, res)->
		request.get(originUrl).pipe res