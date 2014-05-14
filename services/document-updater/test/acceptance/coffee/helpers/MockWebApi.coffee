express = require("express")
app = express()

module.exports = MockWebApi =
	docs: {}

	clearDocs: () -> @docs = {}

	insertDoc: (project_id, doc_id, doc) ->
		@docs["#{project_id}:#{doc_id}"] = doc

	setDocumentLines: (project_id, doc_id, lines, callback = (error) ->) ->
		@docs["#{project_id}:#{doc_id}"] ||= {}
		@docs["#{project_id}:#{doc_id}"].lines = lines
		callback null

	setDocumentVersion: (project_id, doc_id, version, callback = (error) ->) ->
		@docs["#{project_id}:#{doc_id}"] ||= {}
		@docs["#{project_id}:#{doc_id}"].version = version
		callback null

	getDocument: (project_id, doc_id, callback = (error, doc) ->) ->
		callback null, @docs["#{project_id}:#{doc_id}"]

	run: () ->
		app.get "/project/:project_id/doc/:doc_id", (req, res, next) =>
			@getDocument req.params.project_id, req.params.doc_id, (error, doc) ->
				if error?
					res.send 500
				else if doc?
					res.send JSON.stringify doc
				else
					res.send 404

		app.post "/project/:project_id/doc/:doc_id", express.bodyParser(), (req, res, next) =>
			MockWebApi.setDocumentLines req.params.project_id, req.params.doc_id, req.body.lines, (error) ->
				MockWebApi.setDocumentVersion req.params.project_id, req.params.doc_id, req.body.version, (error) ->
					if error1? or error2?
						res.send 500
					else
						res.send 204

		app.listen 3000, (error) ->
			throw error if error?

MockWebApi.run()

