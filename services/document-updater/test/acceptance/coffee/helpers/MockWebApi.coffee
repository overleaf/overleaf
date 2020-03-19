express = require("express")
bodyParser = require("body-parser")
app = express()
MAX_REQUEST_SIZE = 2*(2*1024*1024 + 64*1024)

module.exports = MockWebApi =
	docs: {}

	clearDocs: () -> @docs = {}

	insertDoc: (project_id, doc_id, doc) ->
		doc.version ?= 0
		doc.lines ?= []
		doc.pathname = '/a/b/c.tex'
		@docs["#{project_id}:#{doc_id}"] = doc

	setDocument: (project_id, doc_id, lines, version, ranges, lastUpdatedAt, lastUpdatedBy, callback = (error) ->) ->
		doc = @docs["#{project_id}:#{doc_id}"] ||= {}
		doc.lines = lines
		doc.version = version
		doc.ranges = ranges
		doc.pathname = '/a/b/c.tex'
		doc.lastUpdatedAt = lastUpdatedAt
		doc.lastUpdatedBy = lastUpdatedBy
		callback null

	getDocument: (project_id, doc_id, callback = (error, doc) ->) ->
		callback null, @docs["#{project_id}:#{doc_id}"]

	run: () ->
		app.get "/project/:project_id/doc/:doc_id", (req, res, next) =>
			@getDocument req.params.project_id, req.params.doc_id, (error, doc) ->
				if error?
					res.sendStatus 500
				else if doc?
					res.send JSON.stringify doc
				else
					res.sendStatus 404

		app.post "/project/:project_id/doc/:doc_id", bodyParser.json({limit: MAX_REQUEST_SIZE}), (req, res, next) =>
			MockWebApi.setDocument req.params.project_id, req.params.doc_id, req.body.lines, req.body.version, req.body.ranges, req.body.lastUpdatedAt, req.body.lastUpdatedBy, (error) ->
				if error?
					res.sendStatus 500
				else
					res.sendStatus 204

		app.listen 3000, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockWebApi:", error.message
			process.exit(1)

MockWebApi.run()

