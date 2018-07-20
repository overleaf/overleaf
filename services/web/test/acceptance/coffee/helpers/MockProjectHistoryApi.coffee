_ = require 'lodash'
express = require 'express'
bodyParser = require "body-parser"
app = express()
{ObjectId} = require 'mongojs'

module.exports = MockProjectHistoryApi =
	docs: {}

	oldFiles: {}

	projectVersions: {}

	labels: {}

	addOldFile: (project_id, version, pathname, content) ->
		@oldFiles["#{project_id}:#{version}:#{pathname}"] = content

	setProjectVersion: (project_id, version) ->
		@projectVersions[project_id] = version

	addLabel: (project_id, label_id, comment, version) ->
		@labels[project_id] ?= {}
		@labels[project_id][label_id] = {label_id,comment,version}

	deleteLabel: (project_id, label_id) ->
		delete @labels[project_id][label_id]

	getLabels: (project_id) ->
		return null unless @labels[project_id]?
		_.values @labels[project_id]

	reset: () ->
		@oldFiles = {}
		@projectVersions = {}
		@labels = {}

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

		app.get "/project/:project_id/labels", (req, res, next) =>
			{project_id} = req.params
			labels = @getLabels project_id
			if labels?
				res.json labels
			else
				res.send 404

		app.post "/project/:project_id/user/:user_id/labels", bodyParser.json(), (req, res, next) =>
			{project_id} = req.params
			{comment, version} = req.body
			label_id = new ObjectId().toString()
			@addLabel project_id, label_id, comment, version
			res.json {label_id, comment, version}

		app.delete "/project/:project_id/user/:user_id/labels/:label_id", (req, res, next) =>
			{project_id, label_id} = req.params
			label = @labels[project_id]?[label_id]
			if label?
				@deleteLabel project_id, label_id
				res.send 204
			else
				res.send 404

		app.listen 3054, (error) ->
			throw error if error?
		.on "error", (error) ->
			console.error "error starting MockProjectHistoryApi:", error.message
			process.exit(1)

MockProjectHistoryApi.run()
