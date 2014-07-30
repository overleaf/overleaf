request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ErrorController = require "../Errors/ErrorController"

module.exports = WikiController = 
	getPage: (req, res, next) ->
		page = req.url.replace(/^\/learn/, "").replace(/^\//, "")
		if page == ""
			page = "Main_Page"
		
		wikiUrl = "#{settings.apis.wiki.url}/learn-scripts/api.php"

		logger.log page: page, "proxying request to wiki"
		
		request {
			url: wikiUrl
			qs: {
				page: page
				action: "parse"
				format: "json"
			}
		}, (err, response, data)->
			if response?.statusCode == 404
				return ErrorController.notFound(req, res, next)
			try
				data = JSON.parse(data)
			catch err
				logger.err err:err, data:data, "error parsing data from wiki"
			logger.log data: data, "got response from wiki"
			res.render "wiki/page", {
				content: data.parse.text['*']
				title: data.parse.title
			}
