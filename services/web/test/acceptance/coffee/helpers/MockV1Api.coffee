express = require("express")
app = express()
bodyParser = require('body-parser')
sinon = require 'sinon'

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

	syncUserFeatures: sinon.stub()

	run: () ->
		app.get "/api/v1/sharelatex/users/:v1_user_id/plan_code", (req, res, next) =>
			user = @users[req.params.v1_user_id]
			if user
				res.json user
			else
				res.sendStatus 404

		app.post "/api/v1/sharelatex/users/:v1_user_id/sync", (req, res, next) =>
			@syncUserFeatures(req.params.v1_user_id)
			res.sendStatus 200

		app.post "/api/v1/sharelatex/exports", (req, res, next) =>
			@exportParams = Object.assign({}, req.body)
			res.json exportId: @exportId


		app.listen 5000, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockV1Api:", error.message
			process.exit(1)

MockV1Api.run()
