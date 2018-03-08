express = require("express")
app = express()

module.exports = MockProjectHistoryApi =
	docs: {}

	oldFiles: {}

	addOldFile: (project_id, version, pathname, content) ->
		@oldFiles["#{project_id}:#{version}:#{pathname}"] = content

	run: () ->
		app.post "/project", (req, res, next) =>
			res.json project: id: 1

		app.get "/project/:project_id/version/:version/:pathname", (req, res, next) =>
			{project_id, version, pathname} = req.params
			key = "#{project_id}:#{version}:#{pathname}"
			console.log key, @oldFiles, @oldFiles[key]
			if @oldFiles[key]?
				res.send @oldFiles[key]
			else
				res.send 404

		app.listen 3054, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockProjectHistoryApi:", error.message
			process.exit(1)


MockProjectHistoryApi.run()
