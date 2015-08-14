MongoManager = require "./MongoManager"
MongoAWS = require "./MongoAWS"
LockManager = require "./LockManager"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocArchiveManager =

	archiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		if settings.filestore?.backend != "s3"
			return callback(null)
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.archiveDocChangesWithLock project_id, doc._id, cb
			async.series jobs, callback

	archiveDocChangesWithLock: (project_id, doc_id, callback = (error) ->) ->
		LockManager.runWithLock(
			"HistoryArchiveLock:#{doc_id}",
			(releaseLock) ->
				DocArchiveManager.archiveDocChanges project_id, doc_id, releaseLock
			callback
		)

	archiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getDocChangesCount doc_id, (error, count) ->
			if count == 0
				return callback()
			else
				MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
					MongoAWS.archiveDocHistory project_id, doc_id, (error) ->
						logger.log doc_id:doc_id, error: error, "mongoexport"
						MongoManager.markDocHistoryAsArchived doc_id, update, (error) ->
							return callback(error) if error?
							callback()

	unArchiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		if settings.filestore?.backend != "s3"
			return callback(null)
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.unArchiveDocChanges project_id, doc._id, cb
			async.series jobs, callback

	unArchiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getArchivedDocChanges doc_id, (error, count) ->
			if count == 0
				return callback()
			else
				MongoAWS.unArchiveDocHistory project_id, doc_id, (error) ->
					logger.log doc_id:doc_id, error: error, "mongoimport"
					MongoManager.markDocHistoryAsUnarchived doc_id, (error) ->
						return callback(error) if error?
						callback()
