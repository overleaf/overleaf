express = require("express")
app = express()
bodyParser = require "body-parser"
jsonParser = bodyParser.json()

module.exports = MockDocUpdaterApi =
	project_structures_updates: {}

	clearProjectStructureUpdates: () ->
		@project_structures_updates = {}

	getProjectStructureUpdates: (project_id) ->
		@project_structures_updates[project_id]

	addProjectStructureUpdates: (project_id, userId, docUpdates, fileUpdates) ->
		@project_structures_updates[project_id] ||= {
			docUpdates: []
			fileUpdates: []
		}
		for update in docUpdates
			update.userId = userId
			@project_structures_updates[project_id].docUpdates.push(update)

		for update in fileUpdates
			update.userId = userId
			@project_structures_updates[project_id].fileUpdates.push(update)

	run: () ->
		app.post "/project/:project_id/flush", (req, res, next) =>
			res.sendStatus 200

		app.post "/project/:project_id", jsonParser, (req, res, next) =>
			project_id = req.params.project_id
			{userId, docUpdates, fileUpdates} = req.body
			@addProjectStructureUpdates(project_id, userId, docUpdates, fileUpdates)
			res.sendStatus 200

		app.listen 3003, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockDocUpdaterApi:", error.message
			process.exit(1)

MockDocUpdaterApi.run()
