express = require("express")
app = express()

module.exports = MockDocUpdaterApi =
	run: () ->
		app.post "/project/:project_id/flush", (req, res, next) =>
			res.sendStatus 200

		app.listen 3003, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocUpdaterApi:", error.message
			process.exit(1)

MockDocUpdaterApi.run()
