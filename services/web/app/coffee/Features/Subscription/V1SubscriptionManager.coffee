UserGetter = require "../User/UserGetter"
request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
{ V1ConnectionError, NotFoundError } = require "../Errors/Errors"

module.exports = V1SubscriptionManager =
	# Returned planCode = 'v1_pro' | 'v1_pro_plus' | 'v1_student' | 'v1_free' | null
	# For this to work, we need plans in settings with plan-codes:
	#   - 'v1_pro'
	#   - 'v1_pro_plus'
	#   - 'v1_student'
	#   - 'v1_free'
	getPlanCodeFromV1: (userId, callback=(err, planCode, v1Id)->) ->
		logger.log {userId}, "[V1SubscriptionManager] fetching v1 plan for user"
		V1SubscriptionManager._v1Request userId, {
			method: 'GET',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/plan_code"
		}, (error, body, v1Id) ->
			return callback(error) if error?
			planName = body?.plan_name
			logger.log {userId, planName, body}, "[V1SubscriptionManager] fetched v1 plan for user"
			if planName in ['pro', 'pro_plus', 'student', 'free']
				planName = "v1_#{planName}"
			else
				# Throw away 'anonymous', etc as being equivalent to null
				planName = null
			return callback(null, planName, v1Id)

	notifyV1OfFeaturesChange: (userId, callback = (error) ->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'POST',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/sync"
		}, callback

	getSubscriptionsFromV1: (userId, callback=(err, subscriptions, v1Id) ->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'GET',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/subscriptions"
		}, callback

	getSubscriptionStatusFromV1: (userId, callback=(err, status) ->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'GET',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/subscription_status"
		}, callback

	cancelV1Subscription: (userId, callback=(err)->) ->
		V1SubscriptionManager._v1Request userId, {
			method: 'DELETE',
			url: (v1Id) -> "/api/v1/sharelatex/users/#{v1Id}/subscription"
		}, callback

	v1IdForUser: (userId, callback=(err, v1Id) ->) ->
		UserGetter.getUser userId, {'overleaf.id': 1}, (err, user) ->
			return callback(err) if err?
			v1Id = user?.overleaf?.id
			if !v1Id?
				logger.log {userId}, "[V1SubscriptionManager] no v1 id found for user"

			callback(null, v1Id)

	# v1 accounts created before migration to v2 had github and mendeley for free
	# but these are now paid-for features for new accounts (v1id > cutoff)
	getGrandfatheredFeaturesForV1User: (v1Id) ->
		cutoff = settings.v1GrandfatheredFeaturesUidCutoff
		return {} if !cutoff?
		return {} if !v1Id?

		if (v1Id < cutoff)
			return settings.v1GrandfatheredFeatures or {}
		else
			return {}

	_v1Request: (userId, options, callback=(err, body, v1Id)->) ->
		if !settings?.apis?.v1
			return callback null, null

		V1SubscriptionManager.v1IdForUser userId, (err, v1Id) ->
			return callback(err) if err?
			return callback(null, null, null) if !v1Id?
			request {
				baseUrl: settings.apis.v1.url
				url: options.url(v1Id)
				method: options.method
				auth:
					user: settings.apis.v1.user
					pass: settings.apis.v1.pass
					sendImmediately: true
				json: true,
				timeout: 15 * 1000
			}, (error, response, body) ->
				if error?
					# Specially handle no connection err, so warning can be shown
					error = new V1ConnectionError('No V1 connection') if error.code == 'ECONNREFUSED'
					return callback(error)
				if 200 <= response.statusCode < 300
					return callback null, body, v1Id
				else
					if response.statusCode == 404
						return callback new NotFoundError("v1 user not found: #{userId}")
					else
						return callback new Error("non-success code from v1: #{response.statusCode} #{options.method} #{options.url(v1Id)}")
