express = require("express")
app = express()

module.exports = MockProjectHistoryApi =
	docs: {}

	run: () ->
		app.post "/project", (req, res, next) =>
			res.json project: id: 1

		app.listen 3054, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockProjectHistoryApi:", error.message
			process.exit(1)


MockProjectHistoryApi.run()
