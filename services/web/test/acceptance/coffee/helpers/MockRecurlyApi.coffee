express = require("express")
app = express()
bodyParser = require('body-parser')

app.use(bodyParser.json())

module.exports = MockRecurlyApi =
	subscriptions: {}

	accounts: {}

	redemptions: {}

	coupons: {}

	run: () ->
		app.get '/subscriptions/:id', (req, res, next) =>
			subscription = @subscriptions[req.params.id]
			if !subscription?
				res.status(404).end()
			else
				res.send """
				<subscription>
					<plan_code>#{subscription.plan_code}</plan_code>
					<currency>#{subscription.currency}</currency>
					<state>#{subscription.state}</state>
					<tax_in_cents type="integer">#{subscription.tax_in_cents}</tax_in_cents>
					<tax_rate type="float">#{subscription.tax_rate}</tax_rate>
					<current_period_ends_at type="datetime">#{subscription.current_period_ends_at}</current_period_ends_at>
					<unit_amount_in_cents type="integer">#{subscription.unit_amount_in_cents}</unit_amount_in_cents>
					<account href="accounts/#{subscription.account_id}" />
					<trial_ends_at type="datetime">#{subscription.trial_ends_at}</trial_ends_at>
				</subscription>
				"""

		app.get '/accounts/:id', (req, res, next) =>
			account = @accounts[req.params.id]
			if !account?
				res.status(404).end()
			else
				res.send """
				<account>
					<account_code>#{req.params.id}</account_code>
					<hosted_login_token>#{account.hosted_login_token}</hosted_login_token>
				</account>
				"""

		app.get '/coupons/:code', (req, res, next) =>
			coupon = @coupons[req.params.code]
			if !coupon?
				res.status(404).end()
			else
				res.send """
				<coupon>
					<coupon_code>#{req.params.code}</coupon_code>
					<name>#{coupon.name or ''}</name>
					<description>#{coupon.description or ''}</description>
				</coupon>
				"""

		app.get '/accounts/:id/redemptions', (req, res, next) =>
			redemptions = @redemptions[req.params.id] or []
			redemptionsListXml = ''
			for redemption in redemptions
				redemptionsListXml += """
				<redemption>
					<state>#{redemption.state}</state>
					<coupon_code>#{redemption.coupon_code}</coupon_code>
				</redemption>
				"""

			res.send """
			<redemptions type="array">
				#{redemptionsListXml}
			</redemptions>
			"""

		app.listen 6034, (error) ->
			throw error if error?

MockRecurlyApi.run()
