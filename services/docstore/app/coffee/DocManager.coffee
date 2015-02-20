MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"

module.exports = DocManager =

	getDoc: (project_id, doc_id, callback = (error, doc) ->) ->
		MongoManager.findDoc doc_id, (err, doc)->
			if err?
				return callback(err)
			else if !doc?
				return callback new Errors.NotFoundError("No such doc: #{doc_id} in project #{project_id}")
			callback null, doc

	getAllDocs: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if err?
				return callback(error)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			else
				return callback(null, docs)

	updateDoc: (project_id, doc_id, lines, callback = (error, modified, rev) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->

			isNewDoc = error?.name == new Errors.NotFoundError().name

			if !isNewDoc and error?
				logger.err project_id: project_id, doc_id: doc_id, err:error, "error getting document for update"
				return callback(error)
			else if !isNewDoc and !doc?
				logger.err project_id: project_id, doc_id: doc_id, "existing document to update could not be found"
				return callback new Errors.NotFoundError("No such project/doc to update: #{project_id}/#{doc_id}")
			else if _.isEqual(doc?.lines, lines)
				logger.log project_id: project_id, doc_id: doc_id, rev: doc?.rev, "doc lines have not changed - not updating"
				return callback null, false, doc?.rev

			oldRev = doc?.rev || 0
			logger.log {
				project_id: project_id
				doc_id: doc_id,
				oldDocLines: doc?.lines
				newDocLines: lines
				rev: oldRev
			}, "updating doc lines"
			MongoManager.upsertIntoDocCollection project_id, doc_id, lines, oldRev, (error)->
				return callback(callback) if error?
				callback null, true,  oldRev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc to delete: #{project_id}/#{doc_id}") if !doc?
			MongoManager.upsertIntoDocCollection project_id, doc_id, doc.lines, doc.rev, (error) ->
				return callback(error) if error?
				MongoManager.markDocAsDeleted doc_id, (error) ->
					return callback(error) if error?
					callback()

