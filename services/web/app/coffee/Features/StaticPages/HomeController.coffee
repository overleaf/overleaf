logger = require('logger-sharelatex')
Settings = require('settings-sharelatex')
_ = require('underscore')

Path = require "path"
fs = require "fs"

ErrorController = require "../Errors/ErrorController"
AuthenticationController = require('../Authentication/AuthenticationController')

homepageExists = fs.existsSync Path.resolve(__dirname + "/../../../views/external/home.pug")

module.exports = HomeController =
	index : (req,res)->
		if AuthenticationController.isUserLoggedIn(req)
			if req.query.scribtex_path?
				res.redirect "/project?scribtex_path=#{req.query.scribtex_path}"
			else
				res.redirect '/project'
		else
			HomeController.home(req, res)

	home: (req, res)->
		if Settings.showHomepage and homepageExists
			res.render 'external/home'
		else
			res.redirect "/login"

	externalPage: (page, title) ->
		return (req, res, next = (error) ->) ->
			path = Path.resolve(__dirname + "/../../../views/external/#{page}.pug")
			fs.exists path, (exists) -> # No error in this callback - old method in Node.js!
				if exists
					res.render "external/#{page}.pug",
						title: title
				else
					ErrorController.notFound(req, res, next)
