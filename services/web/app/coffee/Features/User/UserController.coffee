UserHandler = require("./UserHandler")
UserDeleter = require("./UserDeleter")
UserLocator = require("./UserLocator")
User = require("../../models/User").User
newsLetterManager = require('../Newsletter/NewsletterManager')
UserRegistrationHandler = require("./UserRegistrationHandler")
logger = require("logger-sharelatex")
metrics = require("../../infrastructure/Metrics")
Url = require("url")
AuthenticationManager = require("../Authentication/AuthenticationManager")
AuthenticationController = require('../Authentication/AuthenticationController')
UserSessionsManager = require("./UserSessionsManager")
UserUpdater = require("./UserUpdater")
settings = require "settings-sharelatex"

module.exports = UserController =

	deleteUser: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		UserDeleter.deleteUser user_id, (err)->
			if !err?
				req.session?.destroy()
			res.sendStatus(200)

	unsubscribe: (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		UserLocator.findById user_id, (err, user)->
			newsLetterManager.unsubscribe user, ->
				res.send()

	updateUserSettings : (req, res)->
		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log user: user_id, "updating account settings"
		User.findById user_id, (err, user)->
			if err? or !user?
				logger.err err:err, user_id:user_id, "problem updaing user settings"
				return res.sendStatus 500

			if req.body.first_name?
				user.first_name = req.body.first_name.trim()
			if req.body.last_name?
				user.last_name = req.body.last_name.trim()
			if req.body.role?
				user.role = req.body.role.trim()
			if req.body.institution?
				user.institution = req.body.institution.trim()
			if req.body.mode?
				user.ace.mode = req.body.mode
			if req.body.theme?
				user.ace.theme = req.body.theme
			if req.body.fontSize?
				user.ace.fontSize = req.body.fontSize
			if req.body.autoComplete?
				user.ace.autoComplete = req.body.autoComplete
			if req.body.spellCheckLanguage?
				user.ace.spellCheckLanguage = req.body.spellCheckLanguage
			if req.body.pdfViewer?
				user.ace.pdfViewer = req.body.pdfViewer
			user.save (err)->
				newEmail = req.body.email?.trim().toLowerCase()
				if !newEmail? or newEmail == user.email
					return res.sendStatus 200
				else if newEmail.indexOf("@") == -1
					return res.sendStatus(400)
				else
					UserUpdater.changeEmailAddress user_id, newEmail, (err)->
						if err?
							logger.err err:err, user_id:user_id, newEmail:newEmail, "problem updaing users email address"
							if err.message == "alread_exists"
								message = req.i18n.translate("email_already_registered")
							else
								message = req.i18n.translate("problem_changing_email_address")
							return res.send 500, {message:message}
						User.findById user_id, (err, user)->
							if err?
								logger.err err:err, user_id:user_id, "error getting user for email update"
								return res.send 500
							req.user.email = user.email
							UserHandler.populateGroupLicenceInvite user, (err)-> #need to refresh this in the background
								if err?
									logger.err err:err, "error populateGroupLicenceInvite"
								res.sendStatus(200)

	logout : (req, res)->
		metrics.inc "user.logout"
		logger.log user: req?.session?.user, "logging out"
		sessionId = req.sessionID
		user = AuthenticationController.getSessionUser(req)
		req.logout?()  # passport logout
		req.session.destroy (err)->
			if err
				logger.err err: err, 'error destorying session'
			UserSessionsManager.untrackSession(user, sessionId)
			res.redirect '/login'

	register : (req, res, next = (error) ->)->
		email = req.body.email
		if !email? or email == ""
			res.sendStatus 422 # Unprocessable Entity
			return
		UserRegistrationHandler.registerNewUserAndSendActivationEmail email, (error, user, setNewPasswordUrl) ->
			return next(error) if error?
			res.json {
				email: user.email
				setNewPasswordUrl: setNewPasswordUrl
			}

	changePassword : (req, res, next = (error) ->)->
		metrics.inc "user.password-change"
		oldPass = req.body.currentPassword
		user_id = AuthenticationController.getLoggedInUserId(req)
		AuthenticationManager.authenticate {_id:user_id}, oldPass, (err, user)->
			return next(err) if err?
			if(user)
				logger.log user: user._id, "changing password"
				newPassword1 = req.body.newPassword1
				newPassword2 = req.body.newPassword2
				if newPassword1 != newPassword2
					logger.log user: user, "passwords do not match"
					res.send
						message:
						  type:'error'
						  text:'Your passwords do not match'
				else
					logger.log user: user, "password changed"
					AuthenticationManager.setUserPassword user._id, newPassword1, (error) ->
						return next(error) if error?
						UserSessionsManager.revokeAllUserSessions user, [req.sessionID], (err) ->
							return next(err) if err?
							res.send
								message:
									type:'success'
									text:'Your password has been changed'
			else
				logger.log user: user, "current password wrong"
				res.send
					message:
					  type:'error'
					  text:'Your old password is wrong'
