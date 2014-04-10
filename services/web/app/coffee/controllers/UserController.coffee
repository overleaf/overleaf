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


module.exports = {}

	
				




				



