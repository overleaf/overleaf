querystring = require 'querystring'
crypto = require 'crypto'
request = require 'request'
Settings = require "settings-sharelatex"
xml2js = require "xml2js"
logger = require("logger-sharelatex")
Async = require('async')

module.exports = RecurlyWrapper =
	apiUrl : "https://api.recurly.com/v2"

	_addressToXml: (address) ->
		allowedKeys = ['address1', 'address2', 'city', 'country', 'state', 'zip']
		resultString = "<billing_info>\n"
		for k, v of address
			if v and (k in allowedKeys)
				resultString += "<#{k}#{if k == 'address2' then ' nil="nil"' else ''}>#{v || ''}</#{k}>\n"
		resultString += "</billing_info>\n"
		return resultString

	_paypal:
		checkAccountExists: (cache, next) ->
			user = cache.user
			recurly_token_id = cache.recurly_token_id
			subscriptionDetails = cache.subscriptionDetails
			logger.log {user_id: user._id, recurly_token_id}, "checking if recurly account exists for user"
			RecurlyWrapper.apiRequest({
				url:    "accounts/#{user._id}"
				method: "GET"
			}, (error, response, responseBody) ->
				if error
					if response.statusCode == 404  # actually not an error in this case, just no existing account
						cache.userExists = false
						return next(null, cache)
					logger.error {error, user_id: user._id, recurly_token_id}, "error response from recurly while checking account"
					return next(error)
				logger.log {user_id: user._id, recurly_token_id}, "user appears to exist in recurly"
				RecurlyWrapper._parseAccountXml responseBody, (err, account) ->
					if err
						logger.error {err, user_id: user._id, recurly_token_id}, "error parsing account"
						return next(err)
					cache.account = account
					return next(null, cache)
			)
		createAccount: (cache, next) ->
			user = cache.user
			recurly_token_id = cache.recurly_token_id
			subscriptionDetails = cache.subscriptionDetails
			if cache.userExists
				logger.log {user_id: user._id, recurly_token_id}, "user already exists in recurly"
				return next(null, cache)
			logger.log {user_id: user._id, recurly_token_id}, "creating user in recurly"
			address = subscriptionDetails.address
			if !address
				return next(new Error('no address in subscriptionDetails at createAccount stage'))
			requestBody = """
			<account>
				<account_code>#{user._id}</account_code>
				<email>#{user.email}</email>
				<first_name>#{user.first_name}</first_name>
				<last_name>#{user.last_name}</last_name>
				<address>
					<address1>#{address.address1}</address1>
					<address2>#{address.address2}</address2>
					<city>#{address.city || ''}</city>
					<state>#{address.state || ''}</state>
					<zip>#{address.zip || ''}</zip>
					<country>#{address.country}</country>
				</address>
			</account>
			"""
			RecurlyWrapper.apiRequest({
				url    : "accounts"
				method : "POST"
				body   : requestBody
			}, (error, response, responseBody) =>
				if error
					logger.error {error, user_id: user._id, recurly_token_id}, "error response from recurly while creating account"
					return next(error)
				RecurlyWrapper._parseAccountXml responseBody, (err, account) ->
					if err
						logger.error {err, user_id: user._id, recurly_token_id}, "error creating account"
						return next(err)
					cache.account = account
					return next(null, cache)
			)
		createBillingInfo: (cache, next) ->
			user = cache.user
			recurly_token_id = cache.recurly_token_id
			subscriptionDetails = cache.subscriptionDetails
			logger.log {user_id: user._id, recurly_token_id}, "creating billing info in recurly"
			accountCode = cache?.account?.account_code
			if !accountCode
				return next(new Error('no account code at createBillingInfo stage'))
			requestBody = """
			<billing_info>
				<token_id>#{recurly_token_id}</token_id>
			</billing_info>
			"""
			RecurlyWrapper.apiRequest({
				url: "accounts/#{accountCode}/billing_info"
				method: "POST"
				body: requestBody
			}, (error, response, responseBody) =>
				if error
					logger.error {error, user_id: user._id, recurly_token_id}, "error response from recurly while creating billing info"
					return next(error)
				RecurlyWrapper._parseBillingInfoXml responseBody, (err, billingInfo) ->
					if err
						logger.error {err, user_id: user._id, accountCode, recurly_token_id}, "error creating billing info"
						return next(err)
					cache.billingInfo = billingInfo
					return next(null, cache)
			)

		setAddress: (cache, next) ->
			user = cache.user
			recurly_token_id = cache.recurly_token_id
			subscriptionDetails = cache.subscriptionDetails
			logger.log {user_id: user._id, recurly_token_id}, "setting billing address in recurly"
			accountCode = cache?.account?.account_code
			if !accountCode
				return next(new Error('no account code at setAddress stage'))
			address = subscriptionDetails.address
			if !address
				return next(new Error('no address in subscriptionDetails at setAddress stage'))
			requestBody = RecurlyWrapper._addressToXml(address)
			RecurlyWrapper.apiRequest({
				url: "accounts/#{accountCode}/billing_info"
				method: "PUT"
				body: requestBody
			}, (error, response, responseBody) =>
				if error
					logger.error {error, user_id: user._id, recurly_token_id}, "error response from recurly while setting address"
					return next(error)
				RecurlyWrapper._parseBillingInfoXml responseBody, (err, billingInfo) ->
					if err
						logger.error {err, user_id: user._id, recurly_token_id}, "error updating billing info"
						return next(err)
					cache.billingInfo = billingInfo
					return next(null, cache)
			)
		createSubscription: (cache, next) ->
			user = cache.user
			recurly_token_id = cache.recurly_token_id
			subscriptionDetails = cache.subscriptionDetails
			logger.log {user_id: user._id, recurly_token_id}, "creating subscription in recurly"
			requestBody = """
			<subscription>
				<plan_code>#{subscriptionDetails.plan_code}</plan_code>
				<currency>#{subscriptionDetails.currencyCode}</currency>
				<coupon_code>#{subscriptionDetails.coupon_code}</coupon_code>
				<account>
					<account_code>#{user._id}</account_code>
				</account>
			</subscription>
			"""  # TODO: check account details and billing
			RecurlyWrapper.apiRequest({
				url    : "subscriptions"
				method : "POST"
				body   : requestBody
			}, (error, response, responseBody) =>
				if error
					logger.error {error, user_id: user._id, recurly_token_id}, "error response from recurly while creating subscription"
					return next(error)
				RecurlyWrapper._parseSubscriptionXml responseBody, (err, subscription) ->
					if err
						logger.error {err, user_id: user._id, recurly_token_id}, "error creating subscription"
						return next(err)
					cache.subscription = subscription
					return next(null, cache)
			)

	_createPaypalSubscription: (user, subscriptionDetails, recurly_token_id, callback) ->
		logger.log {user_id: user._id, recurly_token_id}, "starting process of creating paypal subscription"
		cache = {user, recurly_token_id, subscriptionDetails}
		Async.waterfall([
			Async.apply(RecurlyWrapper._paypal.checkAccountExists, cache),
			RecurlyWrapper._paypal.createAccount,
			RecurlyWrapper._paypal.createBillingInfo,
			RecurlyWrapper._paypal.setAddress,
			RecurlyWrapper._paypal.createSubscription,
		], (err, result) ->
			if err
				logger.error {err, user_id: user._id, recurly_token_id}, "error in paypal subscription creation process"
				return callback(err)
			if !result.subscription
				err = new Error('no subscription object in result')
				logger.error {err, user_id: user._id, recurly_token_id}, "error in paypal subscription creation process"
				return callback(err)
			logger.log {user_id: user._id, recurly_token_id}, "done creating paypal subscription for user"
			callback(null, result.subscription)
		)

	_createCreditCardSubscription: (user, subscriptionDetails, recurly_token_id, callback) ->
		requestBody = """
		          <subscription>
		            <plan_code>#{subscriptionDetails.plan_code}</plan_code>
		            <currency>#{subscriptionDetails.currencyCode}</currency>
		            <coupon_code>#{subscriptionDetails.coupon_code}</coupon_code>
		            <account>
		            	<account_code>#{user._id}</account_code>
		            	<email>#{user.email}</email>
		            	<first_name>#{user.first_name}</first_name>
		            	<last_name>#{user.last_name}</last_name>
		            	<billing_info>
		            		<token_id>#{recurly_token_id}</token_id>
		            	</billing_info>
		            </account>
		          </subscription>
		          """
		RecurlyWrapper.apiRequest({
			url    : "subscriptions"
			method : "POST"
			body   : requestBody
		}, (error, response, responseBody) =>
			return callback(error) if error?
			RecurlyWrapper._parseSubscriptionXml responseBody, callback
		)

	createSubscription: (user, subscriptionDetails, recurly_token_id, callback)->
		isPaypal = subscriptionDetails.isPaypal
		logger.log {user_id: user._id, isPaypal, recurly_token_id}, "setting up subscription in recurly"
		fn = if isPaypal then RecurlyWrapper._createPaypalSubscription else RecurlyWrapper._createCreditCardSubscription
		fn user, subscriptionDetails, recurly_token_id, callback

	apiRequest : (options, callback) ->
		options.url = RecurlyWrapper.apiUrl + "/" + options.url
		options.headers =
			"Authorization" : "Basic " + new Buffer(Settings.apis.recurly.apiKey).toString("base64")
			"Accept"        : "application/xml"
			"Content-Type"  : "application/xml; charset=utf-8"
		request options, (error, response, body) ->
			unless error? or response.statusCode == 200 or response.statusCode == 201 or response.statusCode == 204
				logger.err err:error, body:body, options:options, statusCode:response?.statusCode, "error returned from recurly"
				error = "Recurly API returned with status code: #{response.statusCode}"
			callback(error, response, body)

	sign : (parameters, callback) ->
		nestAttributesForQueryString = (attributes, base) ->
			newAttributes = {}
			for key, value of attributes
				if base?
					newKey = "#{base}[#{key}]"
				else
					newKey = key

				if typeof value == "object"
					for key, value of nestAttributesForQueryString(value, newKey)
						newAttributes[key] = value
				else
					newAttributes[newKey] = value

			return newAttributes

		crypto.randomBytes 32, (error, buffer) ->
			return callback error if error?
			parameters.nonce = buffer.toString "base64"
			parameters.timestamp = Math.round((new Date()).getTime() / 1000)

			unsignedQuery = querystring.stringify nestAttributesForQueryString(parameters)

			signed = crypto.createHmac("sha1", Settings.apis.recurly.privateKey).update(unsignedQuery).digest("hex")
			signature = "#{signed}|#{unsignedQuery}"

			callback null, signature


	getSubscriptions: (accountId, callback)->
		RecurlyWrapper.apiRequest({
			url: "accounts/#{accountId}/subscriptions"
		}, (error, response, body) =>
			return callback(error) if error?
			RecurlyWrapper._parseXml body, callback
		)


	getSubscription: (subscriptionId, options, callback) ->
		callback = options unless callback?
		options ||= {}

		if options.recurlyJsResult
			url = "recurly_js/result/#{subscriptionId}"
		else
			url = "subscriptions/#{subscriptionId}"

		RecurlyWrapper.apiRequest({
			url: url
		}, (error, response, body) =>
			return callback(error) if error?
			RecurlyWrapper._parseSubscriptionXml body, (error, recurlySubscription) =>
				return callback(error) if error?
				if options.includeAccount
					if recurlySubscription.account? and recurlySubscription.account.url?
						accountId = recurlySubscription.account.url.match(/accounts\/(.*)/)[1]
					else
						return callback "I don't understand the response from Recurly"

					RecurlyWrapper.getAccount accountId, (error, account) ->
						return callback(error) if error?
						recurlySubscription.account = account
						callback null, recurlySubscription

				else
					callback null, recurlySubscription
		)

	getAccounts: (callback)->
		allAccounts = []
		getPageOfAccounts = (cursor = null)=>
			opts =
				url: "accounts"
				qs:
					per_page:200
			if cursor?
				opts.qs.cursor = cursor
			RecurlyWrapper.apiRequest opts, (error, response, body) =>
				return callback(error) if error?
				RecurlyWrapper._parseXml body, (err, data)->
					if err?
						logger.err err:err, "could not get accoutns"
						callback(err)
					allAccounts = allAccounts.concat(data.accounts)
					logger.log "got another #{data.accounts.length}, total now #{allAccounts.length}"
					cursor = response.headers.link?.match(/cursor=([0-9]+)&/)?[1]
					if cursor?
						getPageOfAccounts(cursor)
					else
						callback(err, allAccounts)

		getPageOfAccounts()


	getAccount: (accountId, callback) ->
		RecurlyWrapper.apiRequest({
			url: "accounts/#{accountId}"
		}, (error, response, body) =>
			return callback(error) if error?
			RecurlyWrapper._parseAccountXml body, callback
		)

	getBillingInfo: (accountId, callback)->
		RecurlyWrapper.apiRequest({
			url: "accounts/#{accountId}/billing_info"
		}, (error, response, body) =>
			return callback(error) if error?
			RecurlyWrapper._parseXml body, callback
		)


	updateSubscription: (subscriptionId, options, callback) ->
		logger.log subscriptionId:subscriptionId, options:options, "telling recurly to update subscription"
		requestBody = """
		          <subscription>
		            <plan_code>#{options.plan_code}</plan_code>
		            <timeframe>#{options.timeframe}</timeframe>
		          </subscription>
		          """
		RecurlyWrapper.apiRequest({
			url    : "subscriptions/#{subscriptionId}"
			method : "put"
			body   : requestBody
		}, (error, response, responseBody) =>
			return callback(error) if error?
			RecurlyWrapper._parseSubscriptionXml responseBody, callback
		)

	createFixedAmmountCoupon: (coupon_code, name, currencyCode, discount_in_cents, plan_code, callback)->
		requestBody = """
			<coupon>
				<coupon_code>#{coupon_code}</coupon_code>
				<name>#{name}</name>
				<discount_type>dollars</discount_type>
				<discount_in_cents>
					<#{currencyCode}>#{discount_in_cents}</#{currencyCode}>
				</discount_in_cents>
				<plan_codes>
					<plan_code>#{plan_code}</plan_code>
				</plan_codes>
				<applies_to_all_plans>false</applies_to_all_plans>
			</coupon>
		"""
		logger.log coupon_code:coupon_code, requestBody:requestBody, "creating coupon"
		RecurlyWrapper.apiRequest({
			url    : "coupons"
			method : "post"
			body   : requestBody
		}, (error, response, responseBody) =>
			if error?
				logger.err err:error, coupon_code:coupon_code, "error creating coupon"
			callback(error)
		)


	lookupCoupon: (coupon_code, callback)->
		RecurlyWrapper.apiRequest({
			url: "coupons/#{coupon_code}"
		}, (error, response, body) =>
			return callback(error) if error?
			RecurlyWrapper._parseXml body, callback
		)

	cancelSubscription: (subscriptionId, callback) ->
		logger.log subscriptionId:subscriptionId, "telling recurly to cancel subscription"
		RecurlyWrapper.apiRequest({
			url: "subscriptions/#{subscriptionId}/cancel",
			method: "put"
		}, (error, response, body) ->
			callback(error)
		)

	reactivateSubscription: (subscriptionId, callback) ->
		logger.log subscriptionId:subscriptionId, "telling recurly to reactivating subscription"
		RecurlyWrapper.apiRequest({
			url: "subscriptions/#{subscriptionId}/reactivate",
			method: "put"
		}, (error, response, body) ->
			callback(error)
		)


	redeemCoupon: (account_code, coupon_code, callback)->
		requestBody = """
			<redemption>
				<account_code>#{account_code}</account_code>
				<currency>USD</currency>
			</redemption>
		"""
		logger.log account_code:account_code, coupon_code:coupon_code, requestBody:requestBody, "redeeming coupon for user"
		RecurlyWrapper.apiRequest({
			url    : "coupons/#{coupon_code}/redeem"
			method : "post"
			body   : requestBody
		}, (error, response, responseBody) =>
			if error?
				logger.err err:error, account_code:account_code, coupon_code:coupon_code, "error redeeming coupon"
			callback(error)
		)

	extendTrial: (subscriptionId, daysUntilExpire = 7, callback)->
		next_renewal_date = new Date()
		next_renewal_date.setDate(next_renewal_date.getDate() + daysUntilExpire)
		logger.log subscriptionId:subscriptionId, daysUntilExpire:daysUntilExpire, "Exending Free trial for user"
		RecurlyWrapper.apiRequest({
			url    : "/subscriptions/#{subscriptionId}/postpone?next_renewal_date=#{next_renewal_date}&bulk=false"
			method : "put"
		}, (error, response, responseBody) =>
			if error?
				logger.err err:error,  subscriptionId:subscriptionId, daysUntilExpire:daysUntilExpire,  "error exending trial"
			callback(error)
		)

	_parseSubscriptionXml: (xml, callback) ->
		RecurlyWrapper._parseXml xml, (error, data) ->
			return callback(error) if error?
			if data? and data.subscription?
				recurlySubscription = data.subscription
			else
				return callback "I don't understand the response from Recurly"
			callback null, recurlySubscription

	_parseAccountXml: (xml, callback) ->
		RecurlyWrapper._parseXml xml, (error, data) ->
			return callback(error) if error?
			if data? and data.account?
				account = data.account
			else
				return callback "I don't understand the response from Recurly"
			callback null, account

	_parseBillingInfoXml: (xml, callback) ->
		RecurlyWrapper._parseXml xml, (error, data) ->
			return callback(error) if error?
			if data? and data.account?
				billingInfo = data.billing_info
			else if data? and data.billing_info?
				billingInfo = data.billing_info
			else
				return callback "I don't understand the response from Recurly"
			callback null, billingInfo

	_parseXml: (xml, callback) ->
		convertDataTypes = (data) ->
			if data? and data["$"]?
				if data["$"]["nil"] == "nil"
					data = null
				else if data["$"].href?
					data.url = data["$"].href
					delete data["$"]
				else if data["$"]["type"] == "integer"
					data = parseInt(data["_"], 10)
				else if data["$"]["type"] == "datetime"
					data = new Date(data["_"])
				else if data["$"]["type"] == "array"
					delete data["$"]
					array = []
					for key, value of data
						if value instanceof Array
							array = array.concat(convertDataTypes(value))
						else
							array.push(convertDataTypes(value))
					data = array

			if data instanceof Array
				data = (convertDataTypes(entry) for entry in data)
			else if typeof data == "object"
				for key, value of data
					data[key] = convertDataTypes(value)
			return data

		parser = new xml2js.Parser(
			explicitRoot : true
			explicitArray : false
		)
		parser.parseString xml, (error, data) ->
			return callback(error) if error?
			result = convertDataTypes(data)
			callback null, result
