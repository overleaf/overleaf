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
		res.render 'user/login',
			title: 'Login',
			redir: req.query.redir

	passwordResetPage : (req, res)->
		res.render 'user/passwordReset',
			title: 'Password Reset'



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
					themes: THEME_LIST,
					editors: ['default','vim','emacs'],
					fontSizes: ['10','11','12','13','14','16','20','24']
					languages: Settings.languages,
					accountSettingsTabActive: true

THEME_LIST = []
do generateThemeList = () ->
	files = fs.readdirSync __dirname + '/../../../../public/js/ace/theme'
	for file in files
		if file.slice(-2) == "js"
			cleanName = file.slice(0,-3)
			THEME_LIST.push name: cleanName