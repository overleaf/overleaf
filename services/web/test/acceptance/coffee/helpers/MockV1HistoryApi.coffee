_ = require 'lodash'
express = require 'express'
bodyParser = require "body-parser"
app = express()
{ObjectId} = require 'mongojs'

module.exports = MockV1HistoryApi =
	run: () ->
		app.get "/api/projects/:project_id/version/:version/zip", (req, res, next) =>
			res.header('content-disposition', 'attachment; name=project.zip')
			res.header('content-type', 'application/octet-stream')
			res.send "Mock zip for #{req.params.project_id} at version #{req.params.version}"

		app.listen 3100, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockV1HistoryApi:", error.message
			process.exit(1)

MockV1HistoryApi.run()
