_ = require 'lodash'
express = require 'express'
bodyParser = require "body-parser"
app = express()
{ObjectId} = require 'mongojs'

module.exports = MockV1HistoryApi =
	fakeZipCall: 0
	run: () ->
		app.get "/api/projects/:project_id/version/:version/zip", (req, res, next) =>
			res.header('content-disposition', 'attachment; name=project.zip')
			res.header('content-type', 'application/octet-stream')
			res.send "Mock zip for #{req.params.project_id} at version #{req.params.version}"

		app.get "/fake-zip-download/:project_id/version/:version", (req, res, next) =>
			return res.sendStatus 404 unless @fakeZipCall++ > 0
			res.header('content-disposition', 'attachment; name=project.zip')
			res.header('content-type', 'application/octet-stream')
			res.send "Mock zip for #{req.params.project_id} at version #{req.params.version}"

		app.post "/api/projects/:project_id/version/:version/zip", (req, res, next) =>
			res.json zipUrl: "http://localhost:3100/fake-zip-download/#{req.params.project_id}/version/#{req.params.version}"

		app.listen 3100, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockV1HistoryApi:", error.message
			process.exit(1)

MockV1HistoryApi.run()
