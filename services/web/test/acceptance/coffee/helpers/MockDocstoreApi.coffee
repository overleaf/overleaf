express = require("express")
bodyParser = require "body-parser"
app = express()

module.exports = MockDocStoreApi =
	docs: {}

	run: () ->
		app.post "/project/:project_id/doc/:doc_id", bodyParser.json(), (req, res, next) =>
			{project_id, doc_id} = req.params
			{lines, version, ranges} = req.body
			@docs[project_id] ?= {}
			@docs[project_id][doc_id] = {lines, version, ranges}
			@docs[project_id][doc_id].rev ?= 0
			@docs[project_id][doc_id].rev += 1
			res.json {
				modified: true
				rev: @docs[project_id][doc_id].rev
			}
		
		app.get "/project/:project_id/doc", (req, res, next) =>
			docs = (doc for doc_id, doc of @docs[req.params.project_id])
			res.send JSON.stringify docs

		app.listen 3016, '0.0.0.0', (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocStoreApi:", error.message
			process.exit(1)


MockDocStoreApi.run()

