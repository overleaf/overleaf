async = require("async")
_ = require("underscore")
settings = require("settings-sharelatex")
SubscriptionGroupHandler = require("./SubscriptionGroupHandler")
_s = require("underscore.string")

module.exports = SubscriptionDomainAllocator =


	getLicenceUserCanJoin: (user, callback)->
		licence = SubscriptionDomainAllocator._findDomainLicence(user.email)
		if licence?
			callback null, licence
		else
			callback()

	attemptToJoinGroup: (user, callback)->
		licence = SubscriptionDomainAllocator._findDomainLicence(user.email)
		if licence? and user.emailVerified
			SubscriptionGroupHandler.addUserToGroup licence.adminUser_id, user.email, callback
		else
			callback "user not verified"

	rejectInvitationToGroup: (user, subscription, callback)->
		removeUserFromGroup(subscription.admin_id, user._id, callback)


	getDomainLicencePage: (user)->
		licence = SubscriptionDomainAllocator._findDomainLicence(user.email)
		if licence?.verifyEmail
			return "/user/subscription/#{licence.subscription_id}/group/invited"
		else
			return undefined


	autoAllocate: (user, callback = ->)->
		licence = SubscriptionDomainAllocator._findDomainLicence(user.email)
		#
		if licence?
			SubscriptionGroupHandler.addUserToGroup licence.adminUser_id, user.email, callback
		else
			callback()


	_findDomainLicence: (email)->
		licence = _.find settings.domainLicences, (licence)->
			_.find licence.domains, (domain)->
				_s.endsWith email, domain

		return licence

	findDomainLicenceBySubscriptionId: (subscription_id)->
		licence = _.find settings.domainLicences, (licence)->
			licence?.subscription_id == subscription_id
		return licence

