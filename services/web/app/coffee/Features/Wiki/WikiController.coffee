request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ErrorController = require "../Errors/ErrorController"
_ = require("underscore")
AuthenticationController = require("../Authentication/AuthenticationController")
async = require("async")
other_lngs = ["es"]

module.exports = WikiController = 


	_checkIfLoginIsNeeded: (req, res, next)->
		if settings.apis.wiki.requireLogin
			AuthenticationController.requireLogin()(req, res, next)
		else
			next()

	getPage: (req, res, next) ->
		WikiController._checkIfLoginIsNeeded req, res, ->
			
			page = req.url.replace(/^\/learn/, "").replace(/^\//, "")
			if page == ""
				page = "Main_Page"

			logger.log page: page, "getting page from wiki"
			if _.include(other_lngs, req.lng)
				lngPage = "#{page}_#{req.lng}"
			else
				lngPage = page
			jobs =
				contents: (cb)-> 
					WikiController._getPageContent "Contents", cb
				pageData: (cb)->
					WikiController._getPageContent lngPage, cb
			async.parallel jobs, (error, results)->
				return next(error) if error?
				{pageData, contents} = results
				if pageData.content?.length > 280
					if _.include(other_lngs, req.lng)
						pageData.title = pageData.title.slice(0, pageData.title.length - (req.lng.length+1) )
					WikiController._renderPage(pageData, contents, res)
				else
					WikiController._getPageContent page, (error, pageData) ->
						return next(error) if error?
						WikiController._renderPage(pageData, contents, res)


					

	_getPageContent: (page, callback = (error, data = { content: "", title: "" }) ->) ->
		request {
			url: "#{settings.apis.wiki.url}/learn-scripts/api.php"
			qs: {
				page: decodeURI(page)
				action: "parse"
				format: "json"
			}
		}, (err, response, data)->
			return callback(err) if err?
			try
				data = JSON.parse(data)
			catch err
				logger.err err:err, data:data, "error parsing data from wiki"
			result = 
				content: data?.parse?.text?['*']
				title: data?.parse?.title
			callback null, result


	_renderPage: (page, contents, res)->
		if page.title == "Main Page"
			title = "Documentation"
		else
			title = page.title
			
		res.render "wiki/page", {
			page: page
			contents: contents
			title: title
		}