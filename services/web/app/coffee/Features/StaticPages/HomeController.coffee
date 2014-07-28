logger = require('logger-sharelatex')
_ = require('underscore')

Path = require "path"
fs = require "fs"

ErrorController = require "../Errors/ErrorController"

homepageExists = fs.existsSync Path.resolve(__dirname + "/../../../views/external/home.jade")

module.exports = HomeController =
	index : (req,res)->
		if req.session.user
			if req.query.scribtex_path?
				res.redirect "/project?scribtex_path=#{req.query.scribtex_path}"
			else
				res.redirect '/project'
		else
			if homepageExists
				res.render 'external/home',
					title: 'ShareLaTeX.com'
			else
				res.redirect "/login"

	home: (req, res)->
		if homepageExists
			res.render 'external/home',
				title: 'ShareLaTeX.com'
		else
			res.redirect "/login"


	externalPage: (page, title) ->
		return (req, res, next = (error) ->) ->
			path = Path.resolve(__dirname + "/../../../views/external/#{page}.jade")
			fs.exists path, (exists) -> # No error in this callback - old method in Node.js!
				if exists
					res.render "external/#{page}.jade",
						title: title
				else
					ErrorController.notFound(req, res, next)