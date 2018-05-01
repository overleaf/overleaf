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
			@docs[project_id][doc_id]._id = doc_id
			res.json {
				modified: true
				rev: @docs[project_id][doc_id].rev
			}
		
		app.get "/project/:project_id/doc", (req, res, next) =>
			docs = (doc for doc_id, doc of @docs[req.params.project_id])
			res.send JSON.stringify docs

		app.get "/project/:project_id/doc/:doc_id", (req, res, next) =>
			{project_id, doc_id} = req.params
			doc = @docs[project_id][doc_id]
			if doc.deleted and !req.query.include_deleted
				res.sendStatus 404
			else
				res.send JSON.stringify doc

		app.delete "/project/:project_id/doc/:doc_id", (req, res, next) =>
			{project_id, doc_id} = req.params
			if !@docs[project_id]?
				res.sendStatus 404
			else if !@docs[project_id][doc_id]?
				res.sendStatus 404
			else
				@docs[project_id][doc_id].deleted = true
				res.sendStatus 204

		app.listen 3016, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocStoreApi:", error.message
			process.exit(1)


MockDocStoreApi.run()

