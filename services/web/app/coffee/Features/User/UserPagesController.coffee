UserGetter = require("./UserGetter")
UserSessionsManager = require("./UserSessionsManager")
ErrorController = require("../Errors/ErrorController")
logger = require("logger-sharelatex")
Settings = require("settings-sharelatex")
request = require 'request'
fs = require('fs')
AuthenticationController = require('../Authentication/AuthenticationController')

module.exports = UserPagesController =

	registerPage : (req, res)->
		sharedProjectData =
			project_name:req.query.project_name
			user_first_name:req.query.user_first_name

		newTemplateData = {}
		if req.session.templateData?
			newTemplateData.templateName = req.session.templateData.templateName

		res.render 'user/register',
			title: 'register'
			sharedProjectData: sharedProjectData
			newTemplateData: newTemplateData
			new_email:req.query.new_email || ""

	activateAccountPage: (req, res) ->
		# An 'activation' is actually just a password reset on an account that
		# was set with a random password originally.
		logger.log query:req.query, "activiate account page called"
		if !req.query?.user_id? or !req.query?.token?
			return ErrorController.notFound(req, res)

		UserGetter.getUser req.query.user_id, {email: 1, loginCount: 1}, (error, user) ->
			return next(error) if error?
			if !user
				return ErrorController.notFound(req, res)
			if user.loginCount > 0
				logger.log user:user, "user has already logged in so is active, sending them to /login"
				# Already seen this user, so account must be activate
				# This lets users keep clicking the 'activate' link in their email
				# as a way to log in which, if I know our users, they will.
				res.redirect "/login?email=#{encodeURIComponent(user.email)}"
			else
				res.render 'user/activate',
					title: 'activate_account'
					email: user.email,
					token: req.query.token

	loginPage : (req, res)->
		# if user is being sent to /login with explicit redirect (redir=/foo),
		# such as being sent from the editor to /login, then set the redirect explicitly
		if req.query.redir? and !AuthenticationController._getRedirectFromSession(req)?
			logger.log {redir: req.query.redir}, "setting explicit redirect from login page"
			AuthenticationController.setRedirectInSession(req, req.query.redir)
		res.render 'user/login',
			title: 'login',
			email: req.query.email

	logoutPage: (req, res) ->
		res.render 'user/logout'

	renderReconfirmAccountPage: (req, res) ->
		page_data = {
			reconfirm_email: req?.session?.reconfirm_email
		}
		# when a user must reconfirm their account
		res.render 'user/reconfirm', page_data

	settingsPage : (req, res, next)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log user: user_id, "loading settings page"
		shouldAllowEditingDetails = !(Settings?.ldap?.updateUserDetailsOnLogin) and !(Settings?.saml?.updateUserDetailsOnLogin)
		oauthProviders = Settings.oauthProviders || {}

		UserGetter.getUser user_id, (err, user)->
			return next(err) if err?

			UserPagesController._hasPassword user, (err, passwordPresent) ->
				if err
					logger.err {err}, "error getting password status from v1"
				res.render 'user/settings',
					title:'account_settings'
					user: user,
					hasPassword: passwordPresent,
					shouldAllowEditingDetails: shouldAllowEditingDetails
					languages: Settings.languages,
					accountSettingsTabActive: true,
					oauthProviders: UserPagesController._translateProviderDescriptions(oauthProviders, req),
					thirdPartyIds: UserPagesController._restructureThirdPartyIds(user),
					previewOauth: req.query.prvw?

	sessionsPage: (req, res, next) ->
		user = AuthenticationController.getSessionUser(req)
		logger.log user_id: user._id, "loading sessions page"
		UserSessionsManager.getAllUserSessions user, [req.sessionID], (err, sessions) ->
			if err?
				logger.err {user_id: user._id}, "error getting all user sessions"
				return next(err)
			res.render 'user/sessions',
				title: "sessions"
				sessions: sessions

	_hasPassword: (user, callback) ->
		request.get {
			url: "#{Settings.apis.v1.url}/api/v1/sharelatex/has_password"
			auth: { user: Settings.apis.v1.user, pass: Settings.apis.v1.pass }
			body: { user_id: user?.overleaf?.id }
			timeout: 20 * 1000
			json: true
		}, (err, response, body) ->
			if err
				# for errors assume password and show password setting form
				return callback(err, true)
			else if body?.has_password
				return callback(err, true)
			return callback(err, false)

	_restructureThirdPartyIds: (user) ->
		# 3rd party identifiers are an array of objects
		# this turn them into a single object, which
		# makes data easier to use in template
		return null if !user.thirdPartyIdentifiers || user.thirdPartyIdentifiers.length == 0
		user.thirdPartyIdentifiers.reduce (obj, identifier) ->
			obj[identifier.providerId] = identifier.externalUserId
			obj
		, {}

	_translateProviderDescriptions: (providers, req) ->
		result = {}
		if providers
			for provider, data of providers
				data.description = req.i18n.translate(data.descriptionKey, data.descriptionOptions)
				result[provider] = data
		return result