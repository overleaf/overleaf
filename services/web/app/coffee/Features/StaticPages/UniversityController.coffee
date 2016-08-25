request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
_ = require("underscore")
ErrorController = require "../Errors/ErrorController"
StaticPageHelpers = require("./StaticPageHelpers")
sanitize = require('sanitizer')
Settings = require("settings-sharelatex")
contentful = require('contentful')
marked = require("marked")
sixpack = require("../../infrastructure/Sixpack")



module.exports = UniversityController = 

	getPage: (req, res, next)->
		url = req.url?.toLowerCase()
		universityUrl = "#{settings.apis.university.url}#{url}"
		if StaticPageHelpers.shouldProxy(url) 
			return UniversityController._directProxy universityUrl, res

		logger.log url:url, "proxying request to university api"
		request.get universityUrl, (err, r, data)->
			if r?.statusCode == 404
				return UniversityController.getContentfulPage(req, res, next)
			if err?
				return res.send 500
			data = data.trim()
			try
				data = JSON.parse(data)
				data.content = data.content.replace(/__ref__/g, sanitize.escape(req.query.ref))
			catch err
				logger.err err:err, data:data, "error parsing data from data"
			res.render "university/university_holder", data


	getIndexPage: (req, res)->
		client = sixpack.client(req?.session?.user?._id?.toString() || req.ip)
		client.participate 'instapage-pages', ['default', 'instapage'], (err, response)->
			if response?.alternative?.name == "instapage"
				return res.redirect("/i/university")
			else
				req.url = "/university/index.html"
				UniversityController.getPage req, res

	_directProxy: (originUrl, res)->
		upstream = request.get(originUrl)
		upstream.on "error", (error) ->
			logger.error err: error, "university proxy error"
		upstream.pipe res

	getContentfulPage: (req, res, next)->
		console.log Settings.contentful
		if !Settings.contentful?.uni?.space? and !Settings.contentful?.uni?.accessToken?
			return ErrorController.notFound(req, res, next)

		client = contentful.createClient({
			space: Settings.contentful?.uni?.space
			accessToken: Settings.contentful?.uni?.accessToken
		})

		url = req.url?.toLowerCase().replace("/university/","")
		client.getEntries({content_type: 'caseStudy', 'fields.slug':url})
			.catch (e)->
				return res.send 500
			.then (entry)->
				if !entry? or !entry.items? or entry.items.length == 0
					return ErrorController.notFound(req, res, next)
				viewData = entry.items[0].fields
				viewData.html = marked(viewData.content)
				res.render "university/case_study", viewData:viewData



