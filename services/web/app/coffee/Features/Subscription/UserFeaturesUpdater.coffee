logger = require("logger-sharelatex")
User = require('../../models/User').User
PlansLocator = require("./PlansLocator")

module.exports =
	
	updateFeatures: (user_id, plan_code, callback = (err, features)->)->
		conditions = _id:user_id
		update = {}
		plan = PlansLocator.findLocalPlanInSettings(plan_code)
		logger.log user_id:user_id, features:plan.features, plan_code:plan_code, "updating users features"
		update["features.#{key}"] = value for key, value of plan.features
		User.update conditions, update, (err)->
			callback err, plan.features

