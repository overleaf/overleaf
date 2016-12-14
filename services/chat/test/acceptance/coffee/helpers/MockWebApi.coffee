express = require("express")
app = express()

module.exports = MockWebApi =
	users: {}
	
	addUser: (user_id, user) ->
		@users[user_id] = user
	
	getUser: (user_id, callback = (error, user) ->) ->
		return callback null, @users[user_id]

	run: () ->
		app.get "/user/:user_id/personal_info", (req, res, next) =>
			@getUser req.params.user_id, (error, user) ->
				if error?
					res.send 500
				else if user?
					res.send JSON.stringify user
				else
					res.send 404

		app.listen 3000, (error) ->
			throw error if error?

MockWebApi.run()

