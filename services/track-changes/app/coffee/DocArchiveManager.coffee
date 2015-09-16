MongoManager = require "./MongoManager"
MongoAWS = require "./MongoAWS"
LockManager = require "./LockManager"
DocstoreHandler = require "./DocstoreHandler"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")

module.exports = DocArchiveManager =

	archiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		DocstoreHandler.getAllDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.archiveDocChangesWithLock project_id, doc._id, cb
			async.series jobs, callback

	archiveDocChangesWithLock: (project_id, doc_id, callback = (error) ->) ->
		job = (releaseLock) ->
			DocArchiveManager.archiveDocChanges project_id, doc_id, releaseLock
		LockManager.runWithLock("HistoryArchiveLock:#{doc_id}", job, callback)

	archiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getDocChangesCount doc_id, (error, count) ->
			return callback(error) if error?
			if count == 0
				logger.log {project_id, doc_id}, "document history is empty, not archiving"
				return callback()
			else
				MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
					return callback(error) if error?
					MongoAWS.archiveDocHistory project_id, doc_id, (error) ->
						return callback(error) if error?
						logger.log doc_id:doc_id, project_id:project_id, "exported document to S3"
						MongoManager.markDocHistoryAsArchived doc_id, update, (error) ->
							return callback(error) if error?
							callback()

	unArchiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		DocstoreHandler.getAllDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.unArchiveDocChanges project_id, doc._id, cb
			async.parallelLimit jobs, 4, callback

	unArchiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getArchivedDocChanges doc_id, (error, count) ->
			return callback(error) if error?
			if count == 0
				return callback()
			else
				MongoAWS.unArchiveDocHistory project_id, doc_id, (error) ->
					return callback(error) if error?
					logger.log doc_id:doc_id, project_id:project_id, "imported document from S3"
					MongoManager.markDocHistoryAsUnarchived doc_id, (error) ->
						return callback(error) if error?
						callback()
