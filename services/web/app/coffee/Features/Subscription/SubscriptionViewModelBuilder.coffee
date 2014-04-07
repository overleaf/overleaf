Settings = require('settings-sharelatex')
RecurlyWrapper = require("./RecurlyWrapper")
PlansLocator = require("./PlansLocator")
SubscriptionFormatters = require("./SubscriptionFormatters")
LimitationsManager = require("./LimitationsManager")
SubscriptionLocator = require("./SubscriptionLocator")
_ = require("underscore")

module.exports =

	buildUsersSubscriptionViewModel: (user, callback) ->
		SubscriptionLocator.getUsersSubscription user, (err, subscription)->
				LimitationsManager.userHasFreeTrial user, (err, hasFreeTrial)->
					LimitationsManager.userHasSubscription user, (err, hasSubscription)->
						if hasSubscription
							return callback(error) if error?
							plan = PlansLocator.findLocalPlanInSettings(subscription.planCode)
							RecurlyWrapper.getSubscription subscription.recurlySubscription_id, (err, recurlySubscription)->
								callback null,
									name: plan.name
									nextPaymentDueAt: SubscriptionFormatters.formatDate(recurlySubscription.current_period_ends_at)
									state: recurlySubscription.state
									price: SubscriptionFormatters.formatPrice recurlySubscription.unit_amount_in_cents
									planCode: subscription.planCode
									groupPlan: subscription.groupPlan
						else if hasFreeTrial
							plan = PlansLocator.findLocalPlanInSettings(subscription.freeTrial.planCode)
							callback null,
								name: plan.name
								state: "free-trial"
								planCode: plan.planCode
								groupPlan: subscription.groupPlan
								expiresAt: SubscriptionFormatters.formatDate(subscription.freeTrial.expiresAt)
						else
							callback "User has no subscription"


	buildViewModel : ->
		plans = Settings.plans

		allPlans = {}
		plans.forEach (plan)->
			allPlans[plan.planCode] = plan
			
		result =
			allPlans: allPlans


		result.personalAccount = _.find plans, (plan)->
			plan.planCode == "personal"

		result.studentAccounts = _.filter plans, (plan)->
			plan.planCode.indexOf("student") != -1
			
		result.groupMonthlyPlans = _.filter plans, (plan)->
			plan.groupPlan and !plan.annual

		result.groupAnnualPlans = _.filter plans, (plan)->
			plan.groupPlan and plan.annual

		result.individualMonthlyPlans = _.filter plans, (plan)->
			!plan.groupPlan and !plan.annual and plan.planCode != "personal" and plan.planCode.indexOf("student") == -1

		result.individualAnnualPlans = _.filter plans, (plan)->
			!plan.groupPlan and plan.annual and plan.planCode.indexOf("student") == -1

		return result

