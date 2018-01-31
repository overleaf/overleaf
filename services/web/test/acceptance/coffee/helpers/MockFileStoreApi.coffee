express = require("express")
app = express()

module.exports = MockFileStoreApi =
	files: {}

	run: () ->
		app.post "/project/:project_id/file/:file_id", (req, res, next) =>
			req.on 'data', ->

			req.on 'end', =>
				{project_id, file_id} = req.params
				@files[project_id] ?= {}
				@files[project_id][file_id] = { content : "test-file-content" }
				res.sendStatus 200

		app.listen 3009, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockFileStoreApi:", error.message
			process.exit(1)

MockFileStoreApi.run()
