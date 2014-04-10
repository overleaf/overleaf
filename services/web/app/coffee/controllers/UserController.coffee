User = require('../models/User').User
sanitize = require('sanitizer')
fs = require('fs')
_ = require('underscore')
logger = require('logger-sharelatex')
Security = require('../managers/SecurityManager')
Settings = require('settings-sharelatex')
dropboxHandler = require('../Features/Dropbox/DropboxHandler')
userRegistrationHandler = require('../Features/User/UserRegistrationHandler')
metrics = require('../infrastructure/Metrics')
ReferalAllocator = require('../Features/Referal/ReferalAllocator')
AuthenticationManager = require("../Features/Authentication/AuthenticationManager")
AuthenticationController = require("../Features/Authentication/AuthenticationController")
SubscriptionLocator = require("../Features/Subscription/SubscriptionLocator")
UserDeleter = require("../Features/User/UserDeleter")
EmailHandler = require("../Features/Email/EmailHandler")
Url = require("url")
uuid = require("node-uuid")

module.exports =

	
				



	doRequestPasswordReset : (req, res, next = (error) ->)->
		email = sanitize.escape(req.body.email)
		email = sanitize.escape(email).trim()
		email = email.toLowerCase()
		logger.log email: email, "password reset requested"
		User.findOne {'email':email}, (err, user)->
			if(user?)
				randomPassword = uuid.v4()
				AuthenticationManager.setUserPassword user._id, randomPassword, (error) ->
					emailOpts =
						newPassword: randomPassword
						to: user.email
					EmailHandler.sendEmail "passwordReset", emailOpts, (err)->
						if err?
							logger.err err:err, emailOpts:emailOpts, "problem sending password reset email"
							return res.send 500
						metrics.inc "user.password-reset"
						res.send message:
							 text:'An email with your new password has been sent to you'
							 type:'success'
			else
				res.send message:
					 text:'This email address has not been registered with us'
					 type:'failure'
				logger.info email: email, "no user found with email"
				



