express = require("express")
app = express()
bodyParser = require('body-parser')

app.use(bodyParser.json())

module.exports = MockV1Api =
	users: { }

	setUser: (id, user) ->
		@users[id] = user

	exportId: null

	exportParams: null

	setExportId: (id) ->
		@exportId = id

	getLastExportParams: () ->
		@exportParams

	clearExportParams: () ->
		@exportParams = null

	run: () ->
		app.get "/api/v1/sharelatex/users/:ol_user_id/plan_code", (req, res, next) =>
			user = @users[req.params.ol_user_id]
			if user
				res.json user
			else
				res.sendStatus 404

		app.post "/api/v1/sharelatex/exports", (req, res, next) =>
			#{project, version, pathname}
			@exportParams = Object.assign({}, req.body)
			res.json exportId: @exportId

		app.listen 5000, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockV1Api:", error.message
			process.exit(1)

MockV1Api.run()
