express = require("express")
app = express()

module.exports = MockWebApi =
	users: {}

	projects: {}

	getUser: (user_id, callback = (error) ->) ->
		callback null, @users[user_id] or null

	getProject: (project_id, callback = (error, project) ->) ->
		callback null, @projects[project_id]

	run: () ->
		app.get "/user/:user_id/personal_info", (req, res, next) =>
			@getUser req.params.user_id, (error, user) ->
				if error?
					res.send 500
				if !user?
					res.send 404
				else
					res.send JSON.stringify user

		app.get "/project/:project_id/details", (req, res, next) =>
			@getProject req.params.project_id, (error, project) ->
				if error?
					res.send 500
				if !project?
					res.send 404
				else
					res.send JSON.stringify project

		app.listen 3000, (error) ->
			throw error if error?

MockWebApi.run()

