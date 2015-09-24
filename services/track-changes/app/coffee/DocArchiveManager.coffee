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
		LockManager.runWithLock("HistoryLock:#{doc_id}", job, callback)

	archiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getDocChangesCount doc_id, (error, count) ->
			return callback(error) if error?
			if count == 0
				logger.log {project_id, doc_id}, "document history is empty, not archiving"
				return callback()
			else if count == 1
				logger.log {project_id, doc_id}, "document history only has one entry, not archiving"
				return callback()
			else
				MongoManager.getArchivedDocChanges doc_id, (error, count) ->
					return callback(error) if error?
					if count != 0
						logger.log {project_id, doc_id}, "document history contains archived entries, not archiving"
						return callback()
					MongoManager.getLastCompressedUpdate doc_id, (error, update) ->
						return callback(error) if error?
						logger.log {doc_id, project_id}, "archiving got last compressed update"
						MongoManager.markDocHistoryAsArchiveInProgress doc_id, update, (error) ->
							return callback(error) if error?
							logger.log {doc_id, project_id}, "marked doc history as archive in progress"
							MongoAWS.archiveDocHistory project_id, doc_id, update, (error) ->
								if error?
									logger.log {doc_id, project_id, error}, "error exporting document to S3"
									MongoManager.clearDocHistoryAsArchiveInProgress doc_id, update, (err) ->
										return callback(err) if err?
										logger.log {doc_id, project_id}, "cleared archive in progress flag"
										callback(error)
								else
									logger.log doc_id:doc_id, project_id:project_id, "exported document to S3"
									MongoManager.markDocHistoryAsArchived doc_id, update, (error) ->
										return callback(error) if error?
										logger.log {doc_id, project_id}, "marked doc history as archived"
										callback()

	unArchiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		DocstoreHandler.getAllDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.unArchiveDocChangesWithLock project_id, doc._id, cb
			async.parallelLimit jobs, 4, callback

	unArchiveDocChangesWithLock: (project_id, doc_id, callback = (error) ->) ->
		job = (releaseLock) ->
			DocArchiveManager.unArchiveDocChanges project_id, doc_id, releaseLock
		LockManager.runWithLock("HistoryLock:#{doc_id}", job, callback)

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
