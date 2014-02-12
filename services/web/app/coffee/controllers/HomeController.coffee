logger = require('logger-sharelatex')
_ = require('underscore')
User = require('./UserController')
Quotes = require('../models/Quote').Quote


module.exports =
	index : (req,res)->
		if req.session.user
			if req.query.scribtex_path?
				res.redirect "/project?scribtex_path=#{req.query.scribtex_path}"
			else
				res.redirect '/project'
		else
			res.render 'homepage/home',
				title: 'ShareLaTeX.com'

	comments : (req, res)->
		res.render 'homepage/comments.jade',
			title: 'User Comments'

	resources : (req, res)->
		res.render 'resources.jade',
			title: 'LaTeX Resources'

	tos : (req, res) ->
		res.render 'about/tos',
			title: "Terms of Service"

	privacy : (req, res) ->
		res.render 'about/privacy',
			title: "Privacy Policy"

	about : (req, res) ->
		res.render 'about/about',
			title: "About us"

	notFound: (req, res)->
		res.statusCode = 404
		res.render 'general/404',
			title: "Page Not Found"

	security : (req, res) ->
		res.render 'about/security',
			title: "Security"

	attribution: (req, res) ->
		res.render 'about/attribution',
			title: "Attribution"

	planned_maintenance: (req, res) ->
		res.render 'about/planned_maintenance',
			title: "Planned Maintenance"
