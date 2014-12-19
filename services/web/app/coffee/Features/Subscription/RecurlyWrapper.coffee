querystring = require 'querystring'
crypto = require 'crypto'
request = require 'request'
Settings = require "settings-sharelatex"
xml2js = require "xml2js"
logger = require("logger-sharelatex")

module.exports = RecurlyWrapper =
	apiUrl : "https://api.recurly.com/v2"

	createSubscription: (user, subscriptionDetails, recurly_token_id, callback)->
		requestBody = """
		          <subscription>
		            <plan_code>#{subscriptionDetails.plan_code}</plan_code>
		            <currency>#{subscriptionDetails.currencyCode}</currency>
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
		@apiRequest({
			url    : "subscriptions"
			method : "POST"
			body   : requestBody
		}, (error, response, responseBody) =>
			return callback(error) if error?
			@_parseSubscriptionXml responseBody, callback
		)		

	apiRequest : (options, callback) ->
		options.url = @apiUrl + "/" + options.url
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
	
	getSubscription: (subscriptionId, options, callback) ->
		callback = options unless callback?
		options ||= {}

		if options.recurlyJsResult
			url = "recurly_js/result/#{subscriptionId}"
		else
			url = "subscriptions/#{subscriptionId}"

		@apiRequest({
			url: url
		}, (error, response, body) =>
			return callback(error) if error?
			@_parseSubscriptionXml body, (error, recurlySubscription) =>
				return callback(error) if error?
				if options.includeAccount
					if recurlySubscription.account? and recurlySubscription.account.url?
						accountId = recurlySubscription.account.url.match(/accounts\/(.*)/)[1]
					else
						return callback "I don't understand the response from Recurly"

					@getAccount accountId, (error, account) ->
						return callback(error) if error?
						recurlySubscription.account = account
						callback null, recurlySubscription

				else
					callback null, recurlySubscription
		)

	getAccount: (accountId, callback) ->
		@apiRequest({
			url: "accounts/#{accountId}"
		}, (error, response, body) =>
			return callback(error) if error?
			@_parseAccountXml body, callback
		)
	
	updateSubscription: (subscriptionId, options, callback) ->
		logger.log subscriptionId:subscriptionId, options:options, "telling recurly to update subscription"
		requestBody = """
		          <subscription>
		            <plan_code>#{options.plan_code}</plan_code>
		            <timeframe>#{options.timeframe}</timeframe>
		          </subscription>
		          """
		@apiRequest({
			url    : "subscriptions/#{subscriptionId}"
			method : "put"
			body   : requestBody
		}, (error, response, responseBody) =>
			return callback(error) if error?
			@_parseSubscriptionXml responseBody, callback
		)

	cancelSubscription: (subscriptionId, callback) ->
		logger.log subscriptionId:subscriptionId, "telling recurly to cancel subscription"
		@apiRequest({
			url: "subscriptions/#{subscriptionId}/cancel",
			method: "put"
		}, (error, response, body) ->
			callback(error)
		)

	reactivateSubscription: (subscriptionId, callback) ->
		logger.log subscriptionId:subscriptionId, "telling recurly to reactivating subscription"
		@apiRequest({
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
		@apiRequest({
			url    : "coupons/#{coupon_code}/redeem"
			method : "post"
			body   : requestBody
		}, (error, response, responseBody) =>
			if error?
				logger.err err:error, account_code:account_code, coupon_code:coupon_code, "error redeeming coupon"
			callback(error)
		)


	_parseSubscriptionXml: (xml, callback) ->
		@_parseXml xml, (error, data) ->
			return callback(error) if error?
			if data? and data.subscription?
				recurlySubscription = data.subscription
			else
				return callback "I don't understand the response from Recurly"
			callback null, recurlySubscription

	_parseAccountXml: (xml, callback) ->
		@_parseXml xml, (error, data) ->
			return callback(error) if error?
			if data? and data.account?
				account = data.account
			else
				return callback "I don't understand the response from Recurly"
			callback null, account

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

			

