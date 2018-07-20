express = require("express")
app = express()

module.exports = MockProjectHistoryApi =
	docs: {}

	oldFiles: {}

	projectVersions: {}

	addOldFile: (project_id, version, pathname, content) ->
		@oldFiles["#{project_id}:#{version}:#{pathname}"] = content

	setProjectVersion: (project_id, version) ->
		@projectVersions[project_id] = version

	run: () ->
		app.post "/project", (req, res, next) =>
			res.json project: id: 1

		app.get "/project/:project_id/version/:version/:pathname", (req, res, next) =>
			{project_id, version, pathname} = req.params
			key = "#{project_id}:#{version}:#{pathname}"
			if @oldFiles[key]?
				res.send @oldFiles[key]
			else
				res.send 404

		app.get "/project/:project_id/version", (req, res, next) =>
			{project_id} = req.params
			if @projectVersions[project_id]?
				res.json version: @projectVersions[project_id]
			else
				res.send 404

		app.listen 3054, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockProjectHistoryApi:", error.message
			process.exit(1)


MockProjectHistoryApi.run()
