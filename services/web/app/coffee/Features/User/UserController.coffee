UserDeleter = require("./UserDeleter")
UserLocator = require("./UserLocator")
User = require("../../models/User").User
newsLetterManager = require('../Newsletter/NewsletterManager')
sanitize = require('sanitizer')
UserRegistrationHandler = require("./UserRegistrationHandler")
logger = require("logger-sharelatex")
metrics = require("../../infrastructure/Metrics")
Url = require("url")
AuthenticationController = require("../Authentication/AuthenticationController")
AuthenticationManager = require("../Authentication/AuthenticationManager")
ReferalAllocator = require("../Referal/ReferalAllocator")

module.exports =

	deleteUser: (req, res)->
		user_id = req.session.user._id
		UserDeleter.deleteUser user_id, (err)->
			if !err?
				req.session.destroy()
			res.send(200)

	unsubscribe: (req, res)->
		UserLocator.findById req.session.user._id, (err, user)->
			newsLetterManager.unsubscribe user, ->
				res.send()

	updateUserSettings : (req, res)->
		logger.log user: req.session.user, "updating account settings"
		User.findById req.session.user._id, (err, user)->
			if err? or !user?
				logger.err err:err, user_id:req.session.user._id, "problem updaing user settings"
				return res.send 500
			user.first_name   = sanitize.escape(req.body.first_name).trim()
			user.last_name    = sanitize.escape(req.body.last_name).trim()
			user.ace.mode     = sanitize.escape(req.body.mode).trim()
			user.ace.theme    = sanitize.escape(req.body.theme).trim()
			user.ace.fontSize = sanitize.escape(req.body.fontSize).trim()
			user.ace.autoComplete = req.body.autoComplete == "true"
			user.ace.spellCheckLanguage = req.body.spellCheckLanguage
			user.ace.pdfViewer = req.body.pdfViewer
			user.save ->
				res.send()

	logout : (req, res)->
		metrics.inc "user.logout"
		logger.log user: req?.session?.user, "logging out"
		req.session.destroy (err)->
			if err
				logger.err err: err, 'error destorying session'
			res.redirect '/login'

	register : (req, res, next = (error) ->)->
		logger.log email: req.body.email, "attempted register"
		redir = Url.parse(req.body.redir or "/project").path
		UserRegistrationHandler.registerNewUser req.body, (err, user)->
			if err == "EmailAlreadyRegisterd"
				return AuthenticationController.login req, res
			else if err?
				next(err)
			else
				metrics.inc "user.register.success"
				req.session.user = user
				req.session.justRegistered = true
				ReferalAllocator.allocate req.session.referal_id, user._id, req.session.referal_source, req.session.referal_medium
				res.send
					redir:redir
					id:user._id.toString()
					first_name: user.first_name
					last_name: user.last_name
					email: user.email
					created: Date.now()


	changePassword : (req, res, next = (error) ->)->
		metrics.inc "user.password-change"
		oldPass = req.body.currentPassword
		AuthenticationManager.authenticate {_id:req.session.user._id}, oldPass, (err, user)->
			return next(err) if err?
			if(user)
				logger.log user: req.session.user, "changing password"
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