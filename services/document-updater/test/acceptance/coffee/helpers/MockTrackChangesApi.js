express = require("express")
app = express()

module.exports = MockTrackChangesApi =
	flushDoc: (doc_id, callback = (error) ->) ->
		callback()

	run: () ->
		app.post "/project/:project_id/doc/:doc_id/flush", (req, res, next) =>
			@flushDoc req.params.doc_id, (error) ->
				if error?
					res.sendStatus 500
				else
					res.sendStatus 204

		app.listen 3015, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockTrackChangesApi:", error.message
			process.exit(1)

MockTrackChangesApi.run()

