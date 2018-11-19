express = require("express")
app = express()
bodyParser = require('body-parser')

app.use(bodyParser.json())

module.exports = MockRecurlyApi =
	subscriptions: {}

	accounts: {}

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
					<hosted_login_token>#{account.hosted_login_token}</hosted_login_token>
				</account>
				"""

		app.listen 6034, (error) ->
			throw error if error?

MockRecurlyApi.run()
