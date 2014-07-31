request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
ErrorController = require "../Errors/ErrorController"

module.exports = WikiController = 
	getPage: (req, res, next) ->
		page = req.url.replace(/^\/learn/, "").replace(/^\//, "")
		if page == ""
			page = "Main_Page"

		logger.log page: page, "getting page from wiki"
		
		WikiController._getPageContent "Contents", (error, contents) ->
			return next(error) if error?
			WikiController._getPageContent page, (error, page) ->
				return next(error) if error?
				res.render "wiki/page", {
					page: page
					contents: contents
				}
		
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
			callback null, {
				content: data?.parse?.text?['*']
				title: data?.parse?.title
			}
