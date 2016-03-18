Errors = require "./Errors"
logger = require "logger-sharelatex"

module.exports = ErrorController =
	notFound: (req, res)->
		res.status(404)
		res.render 'general/404',
			title: "page_not_found"

	serverError: (req, res)->
		res.status(500)
		res.render 'general/500',
			title: "Server Error"
	
	handleError: (error, req, res, next) ->
		if error?.code is 'EBADCSRFTOKEN'
			logger.log err: error,url:req.url, method:req.method, user:req?.sesson?.user, "invalid csrf"
			res.sendStatus(403)
			return
		logger.error err: error, url:req.url, method:req.method, user:req?.sesson?.user, "error passed to top level next middlewear"
		if error instanceof Errors.NotFoundError
			ErrorController.notFound req, res
		else
			ErrorController.serverError req, res