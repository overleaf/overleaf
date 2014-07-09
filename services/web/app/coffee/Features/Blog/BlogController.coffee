request = require("request")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")

module.exports =

	getPage: (req, res)->
		url = req.url
		logger.log url:url, "proxying request to blog api"
		request.get "#{settings.apis.blog.url}#{url}", (err, r, data)->
			console.log data
			try
				data = JSON.parse(data)
			catch err
				logger.err err:err, data:data, "error parsing data from data"
			res.render "blog/#{data.layout}", data

