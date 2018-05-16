UserGetter = require "../User/UserGetter"
request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports = V1SubscriptionManager =
	# Returned planCode = 'v1_pro' | 'v1_pro_plus' | 'v1_student' | 'v1_free' | null
	# For this to work, we need plans in settings with plan-codes:
	#   - 'v1_pro'
	#   - 'v1_pro_plus'
	#   - 'v1_student'
	#   - 'v1_free'
	getPlanCodeFromV1: (userId, callback=(err, planCode)->) ->
		logger.log {userId}, "[V1SubscriptionManager] fetching v1 plan for user"
		UserGetter.getUser userId, {'overleaf.id': 1}, (err, user) ->
			return callback(err) if err?
			v1Id = user?.overleaf?.id
			if !v1Id?
				logger.log {userId}, "[V1SubscriptionManager] no v1 id found for user"
				return callback(null, null)
			V1SubscriptionManager._v1PlanRequest v1Id, (err, body) ->
				return callback(err) if err?
				planName = body?.plan_name
				logger.log {userId, planName, body}, "[V1SubscriptionManager] fetched v1 plan for user"
				if planName in ['pro', 'pro_plus', 'student', 'free']
					planName = "v1_#{planName}"
				else
					# Throw away 'anonymous', etc as being equivalent to null
					planName = null
				return callback(null, planName)

	_v1PlanRequest: (v1Id, callback=(err, body)->) ->
		if !settings?.apis?.v1
			return callback null, null
		request {
			method: 'GET',
			url: settings.apis.v1.url +
				"/api/v1/sharelatex/users/#{v1Id}/plan_code"
			auth:
				user: settings.apis.v1.user
				pass: settings.apis.v1.pass
				sendImmediately: true
			json: true,
			timeout: 5 * 1000
		}, (error, response, body) ->
			return callback(error) if error?
			if 200 <= response.statusCode < 300
				return callback null, body
			else
				return callback new Error("non-success code from v1: #{response.statusCode}")