express = require("express")
app = express()

module.exports = MockWebApi =
	users: {}

	getUser: (user_id, callback = (error) ->) ->
		callback null, @users[user_id]

	run: () ->
		app.get "/user/:user_id/personal_info", (req, res, next) =>
			@getUser req.params.user_id, (error, user) ->
				if error?
					res.send 500
				if !user?
					res.send 404
				else
					res.send JSON.stringify user

		app.listen 3000, (error) ->
			throw error if error?

MockWebApi.run()

