express = require("express")
app = express()

module.exports = MockDocUpdaterApi =
	docs: {}

	getAllDoc: (project_id, callback = (error) ->) ->
		callback null, @docs

	run: () ->
		app.get "/project/:project_id/doc", (req, res, next) =>
			@getAllDoc req.params.project_id, (error, docs) ->
				if error?
					res.send 500
				if !docs?
					res.send 404
				else
					res.send JSON.stringify docs

		app.listen 3016, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocStoreApi:", error.message
			process.exit(1)

MockDocUpdaterApi.run()

