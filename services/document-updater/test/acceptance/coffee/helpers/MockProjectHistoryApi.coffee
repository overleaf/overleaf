express = require("express")
app = express()

module.exports = MockProjectHistoryApi =
	flushProject: (doc_id, callback = (error) ->) ->
		callback()

	run: () ->
		app.post "/project/:project_id/flush", (req, res, next) =>
			@flushProject req.params.project_id, (error) ->
				if error?
					res.send 500
				else
					res.send 204

		app.listen 3054, (error) ->
			throw error if error?

MockProjectHistoryApi.run()
