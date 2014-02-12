Settings = require("settings-sharelatex")

module.exports =

	findLocalPlanInSettings: (planCode) ->
		for plan in Settings.plans
			return plan if plan.planCode == planCode
		return null

