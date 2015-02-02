async = require("async")
_ = require("underscore")
settings = require("settings-sharelatex")
SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
_s = require("underscore.string")

module.exports = SubscriptionDomainAllocator =

	autoAllocate: (user, callback = ->)->
		licence = SubscriptionDomainAllocator._findDomainLicence(user.email)
		if licence?
			SubscriptionGroupHandler.addUserToGroup licence.adminUser_id, user.email, callback
		else
			callback()


	_findDomainLicence: (email)->
		licence = _.find settings.domainLicences, (licence)->
			_.find licence.domains, (domain)->
				_s.endsWith email, domain

		return licence


