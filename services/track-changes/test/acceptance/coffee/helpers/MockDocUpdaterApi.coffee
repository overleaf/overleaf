express = require("express")
app = express()

module.exports = MockDocUpdaterApi =
	docs: {}

	getDoc: (project_id, doc_id, callback = (error) ->) ->
		callback null, @docs[doc_id]

	run: () ->
		app.get "/project/:project_id/doc/:doc_id", (req, res, next) =>
			@getDoc req.params.project_id, req.params.doc_id, (error, doc) ->
				if error?
					res.send 500
				if !doc?
					res.send 404
				else
					res.send JSON.stringify doc

		app.listen 3003, (error) ->
			throw error if error?

MockDocUpdaterApi.run()

