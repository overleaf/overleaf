express = require("express")
app = express()

module.exports = MockTrackChangesApi =
	flushDoc: (doc_id, callback = (error) ->) ->
		callback()

	run: () ->
		app.post "/project/:project_id/doc/:doc_id/flush", (req, res, next) =>
			@flushDoc req.params.doc_id, (error) ->
				if error?
					res.send 500
				else
					res.send 204

		app.listen 3014, (error) ->
			throw error if error?

MockTrackChangesApi.run()

