MongoManager = require "./MongoManager"
MongoAWS = require "./MongoAWS"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocArchiveManager =

	archiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.archiveDocChanges project_id, doc._id, cb
			async.series jobs, callback


	archiveDocChanges: (project_id, doc_id, callback)->
		MongoAWS.archiveDocHistory project_id, doc_id, (error) ->
			logger.log doc_id:doc_id, error: error, "mongoexport"
			callback()