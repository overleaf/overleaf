Settings = require 'settings-sharelatex'
if Settings.analytics?.mixpanel?
	Mixpanel = require("mixpanel").init(Settings.analytics.mixpanel.token)
else
	Mixpanel = null
logger = require "logger-sharelatex"
async = require 'async'

module.exports = AnalyticsManager =

	track: (user, event, properties, callback = (error)->) ->
		properties.distinct_id = @getDistinctId user
		properties.mp_name_tag = user.email if user.email?
		logger.log user_id: properties.distinct_id, event: event, properties: properties, "tracking event"
		Mixpanel?.track event, properties
		callback()

	set: (user, properties, callback = (error)->) ->
		properties["$first_name"] = user.first_name if user.first_name?
		properties["$last_name"] = user.last_name if user.last_name?
		properties["$email"] = user.email if user.email?
		Mixpanel?.people.set @getDistinctId(user), properties
		callback()

	increment: (user, property, amount, callback = (error)->) ->
		Mixpanel?.people.increment @getDistinctId(user), property, amount
		callback()

	# TODO: Remove this one month after the ability to start free trials was removed
	trackFreeTrialExpired: (user, callback = (error)->) ->
		async.series [
			(callback) => @track user, "free trial expired", {}, callback
			(callback) => @set user, { free_trial_expired_at: new Date() }, callback
		], callback

	trackSubscriptionStarted: (user, plan_code, callback = (error)->) ->
		async.series [
			(callback) => @track user, "subscribed", plan_code: plan_code, callback
			(callback) => @set user, { plan_code: plan_code, subscribed_at: new Date() }, callback
		], callback

	trackSubscriptionCancelled: (user, callback = (error)->) ->
		async.series [
			(callback) => @track user, "cancelled", callback
			(callback) => @set user, { cancelled_at: new Date() }, callback
		], callback

	trackLogIn: (user, callback = (error)->) ->
		async.series [
			(callback) => @track user, "logged in", {}, callback
			(callback) => @set user, { last_logged_id: new Date() }, callback
		], callback

	trackOpenEditor: (user, project, callback = (error)->) ->
		async.series [
			(callback) => @set user, { last_opened_editor: new Date() }, callback
			(callback) => @increment user, "editor_opens", 1, callback
		], callback

	trackReferral: (user, referal_source, referal_medium, callback = (error) ->) ->
		async.series [
			(callback) =>
				@track user, "Referred another user", { source: referal_source, medium: referal_medium }, callback
			(callback) =>
				@track user, "Referred another user via #{referal_source}", { medium: referal_medium }, callback
		], callback

	getDistinctId: (user) -> user.id || user._id || user

