async = require("async")
_ = require("underscore")
settings = require("settings-sharelatex")

module.exports = SubscriptionDomainHandler =


	getLicenceUserCanJoin: (user)->
		licence = SubscriptionDomainHandler._findDomainLicence(user.email)
		return licence

	getDomainLicencePage: (user)->
		licence = SubscriptionDomainHandler._findDomainLicence(user.email)
		if licence?.verifyEmail
			return "/user/subscription/domain/join"
		else
			return undefined

	_findDomainLicence: (email)->
		licence = _.find settings.domainLicences, (licence)->
			_.find licence.domains, (domain)->
				regex = "[@\.]#{domain}"
				return email.match(regex)

		return licence

	findDomainLicenceBySubscriptionId: (subscription_id)->
		licence = _.find settings.domainLicences, (licence)->
			licence?.subscription_id == subscription_id
		return licence
