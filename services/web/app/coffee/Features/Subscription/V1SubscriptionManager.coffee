UserGetter = require "../User/UserGetter"
request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
{ V1ConnectionError } = require "../Errors/Errors"

module.exports = V1SubscriptionManager =
	# Returned planCode = 'v1_pro' | 'v1_pro_plus' | 'v1_student' | 'v1_free' | null
	# For this to work, we need plans in settings with plan-codes:
	#   - 'v1_pro'
	#   - 'v1_pro_plus'
	#   - 'v1_student'
	#   - 'v1_free'
	getPlanCodeFromV1: (userId, callback=(err, planCode)->) ->
		logger.log {userId}, "[V1SubscriptionManager] fetching v1 plan for user"
		V1SubscriptionManager._v1Request userId, {
			method: 'GET',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/plan_code"
		}, (error, body) ->
			return callback(error) if error?
			planName = body?.plan_name
			logger.log {userId, planName, body}, "[V1SubscriptionManager] fetched v1 plan for user"
			if planName in ['pro', 'pro_plus', 'student', 'free']
				planName = "v1_#{planName}"
			else
				# Throw away 'anonymous', etc as being equivalent to null
				planName = null
			return callback(null, planName)

	notifyV1OfFeaturesChange: (userId, callback = (error) ->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'POST',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/sync"
		}, callback

	getSubscriptionsFromV1: (userId, callback=(err, subscriptions) ->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'GET',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/subscriptions"
		}, callback

	_v1Request: (userId, options, callback=(err, body)->) ->
		if !settings?.apis?.v1
			return callback null, null
		UserGetter.getUser userId, {'overleaf.id': 1}, (err, user) ->
			return callback(err) if err?
			v1Id = user?.overleaf?.id
			if !v1Id?
				logger.log {userId}, "[V1SubscriptionManager] no v1 id found for user"
				return callback(null, null)
			request {
				baseUrl: settings.apis.v1.url
				url: options.url(v1Id)
				method: options.method
				auth:
					user: settings.apis.v1.user
					pass: settings.apis.v1.pass
					sendImmediately: true
				json: true,
				timeout: 5 * 1000
			}, (error, response, body) ->
				if error?
					# Specially handle no connection err, so warning can be shown
					error = new V1ConnectionError('No V1 connection') if error.code == 'ECONNREFUSED'
					return callback(error)
				if 200 <= response.statusCode < 300
					return callback null, body
				else
					return callback new Error("non-success code from v1: #{response.statusCode}")

