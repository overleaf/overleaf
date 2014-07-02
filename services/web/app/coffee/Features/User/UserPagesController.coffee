UserLocator = require("./UserLocator")
dropboxHandler = require('../Dropbox/DropboxHandler')
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
			title: 'Register'
			redir: req.query.redir
			sharedProjectData: sharedProjectData
			newTemplateData: newTemplateData
			new_email:req.query.new_email || ""

	loginPage : (req, res)->
		console.info req
		res.render 'user/login',
			title: 'Login',
			redir: req.query.redir

	settingsPage : (req, res)->
		logger.log user: req.session.user, "loading settings page"
		UserLocator.findById req.session.user._id, (err, user)->
			dropboxHandler.getUserRegistrationStatus user._id, (err, status)->
				userIsRegisteredWithDropbox = !err? and status.registered
				res.render 'user/settings',
					title:'Your settings',
					userHasDropboxFeature: user.features.dropbox
					userIsRegisteredWithDropbox: userIsRegisteredWithDropbox
					user: user,
					languages: Settings.languages,
					accountSettingsTabActive: true
