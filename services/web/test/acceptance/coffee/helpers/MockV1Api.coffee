express = require("express")
app = express()
bodyParser = require('body-parser')

app.use(bodyParser.json())

module.exports = MockV1Api =

	exportId: null

	exportParams: null

	setExportId: (id) ->
		@exportId = id

	getLastExportParams: () ->
		@exportParams

	clearExportParams: () ->
		@exportParams = null

	run: () ->
		app.post "/api/v1/sharelatex/exports", (req, res, next) =>
			#{project, version, pathname}
			@exportParams = Object.assign({}, req.body)
			res.json exportId: @exportId

		app.listen 5000, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockOverleafAPI:", error.message
			process.exit(1)

MockV1Api.run()
