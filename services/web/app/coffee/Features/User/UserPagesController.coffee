UserLocator = require("./UserLocator")
logger = require("logger-sharelatex")
Settings = require("settings-sharelatex")
fs = require('fs')

module.exports =

	registerPage : (req, res)->
		sharedProjectData =
			project_name:req.query.project_name
			user_first_name:req.query.user_first_name

		newTemplateData = {}
		if req.session.templateData?
			newTemplateData.templateName = req.session.templateData.templateName

		res.render 'user/register',
			title: 'register'
			redir: req.query.redir
			sharedProjectData: sharedProjectData
			newTemplateData: newTemplateData
			new_email:req.query.new_email || ""

	loginPage : (req, res)->
		res.render 'user/login',
			title: 'login',
			redir: req.query.redir

	settingsPage : (req, res, next)->
		logger.log user: req.session.user, "loading settings page"
		UserLocator.findById req.session.user._id, (err, user)->
			return next(err) if err?
			res.render 'user/settings',
				title:'account_settings'
				user: user,
				languages: Settings.languages,
				accountSettingsTabActive: true
