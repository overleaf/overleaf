logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
_ = require('underscore')
Features = require "../../infrastructure/Features"

Path = require "path"
fs = require "fs"

ErrorController = require "../Errors/ErrorController"
AuthenticationController = require('../Authentication/AuthenticationController')

slHomepageExists = fs.existsSync Path.resolve(__dirname + "/../../../views/external/home/sl.pug")
v2HomepageExists = fs.existsSync Path.resolve(__dirname + "/../../../views/external/home/v2.pug")

module.exports = HomeController =
	index : (req,res)->
		if AuthenticationController.isUserLoggedIn(req)
			if req.query.scribtex_path?
				res.redirect "/project?scribtex_path=#{req.query.scribtex_path}"
			else
				res.redirect '/project'
		else
			HomeController.home(req, res)

	home: (req, res, next)->
		if Features.hasFeature('homepage') and !Settings.overleaf and slHomepageExists
			res.render 'external/home/sl'
		else if Features.hasFeature('homepage') and Settings.overleaf and v2HomepageExists
			res.render 'external/home/v2'
		else
			res.redirect '/login'

	externalPage: (page, title) ->
		return (req, res, next = (error) ->) ->
			path = Path.resolve(__dirname + "/../../../views/external/#{page}.pug")
			fs.exists path, (exists) -> # No error in this callback - old method in Node.js!
				if exists
					res.render "external/#{page}.pug",
						title: title
				else
					ErrorController.notFound(req, res, next)
