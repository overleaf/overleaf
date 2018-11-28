express = require("express")
app = express()
bodyParser = require "body-parser"
jsonParser = bodyParser.json()

module.exports = MockDocUpdaterApi =
	updates: {}

	clearProjectStructureUpdates: () ->
		@updates = {}

	getProjectStructureUpdates: (project_id) ->
		@updates[project_id] || { docUpdates: [], fileUpdates: [] }

	addProjectStructureUpdates: (project_id, userId, docUpdates, fileUpdates, version) ->
		@updates[project_id] ||= { docUpdates: [], fileUpdates: [] }

		for update in docUpdates
			update.userId = userId
			@updates[project_id].docUpdates.push(update)

		for update in fileUpdates
			update.userId = userId
			@updates[project_id].fileUpdates.push(update)
		
		@updates[project_id].version = version

	run: () ->
		app.post "/project/:project_id/flush", (req, res, next) =>
			res.sendStatus 204

		app.post "/project/:project_id", jsonParser, (req, res, next) =>
			project_id = req.params.project_id
			{userId, docUpdates, fileUpdates, version} = req.body
			@addProjectStructureUpdates(project_id, userId, docUpdates, fileUpdates, version)
			res.sendStatus 200

		app.post "/project/:project_id/doc/:doc_id", (req, res, next) =>
			res.sendStatus 204

		app.post "/project/:project_id/doc/:doc_id/flush", (req, res, next) =>
			res.sendStatus 204

		app.delete "/project/:project_id/doc/:doc_id", (req, res, next) =>
			res.sendStatus 204

		app.listen 3003, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocUpdaterApi:", error.message
			process.exit(1)

MockDocUpdaterApi.run()
