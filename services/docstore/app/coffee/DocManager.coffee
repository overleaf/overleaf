MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
DocArchive = require "./DocArchiveManager"

module.exports = DocManager =

	getDoc: (project_id, doc_id, callback = (error, doc) ->) ->
		MongoManager.findDoc project_id, doc_id, (err, doc)->
			if err?
				return callback(err)
			else if !doc?
				return callback new Errors.NotFoundError("No such doc: #{doc_id} in project #{project_id}")
			else if doc?.inS3
				DocArchive.unarchiveDoc project_id, doc_id, (err)->
					if err?
						logger.err err:err, project_id:project_id, doc_id:doc_id, "error unarchiving doc"
						return callback(err)
					DocManager.getDoc project_id, doc_id, callback
			else
				callback err, doc

	getAllDocs: (project_id, callback = (error, docs) ->) ->
		DocArchive.unArchiveAllDocs project_id, (error) ->
			MongoManager.getProjectsDocs project_id, (error, docs) ->
				if err?
					return callback(error)
				else if !docs?
					return callback new Errors.NotFoundError("No docs for project #{project_id}")
				else
					return callback(null, docs)

	updateDoc: (project_id, doc_id, lines, callback = (error, modified, rev) ->) ->
		DocManager.getDoc project_id, doc_id, (err, doc)->
			if err? and !(err instanceof Errors.NotFoundError)
				logger.err project_id: project_id, doc_id: doc_id, err:err, "error getting document for update"
				return callback(err)

			isNewDoc = lines.length == 0
			linesAreSame =  _.isEqual(doc?.lines, lines)

			if linesAreSame and !isNewDoc
				logger.log project_id: project_id, doc_id: doc_id, rev: doc?.rev, "doc lines have not changed - not updating"
				return callback null, false, doc?.rev
			else
				oldRev = doc?.rev || 0
				logger.log {
					project_id: project_id
					doc_id: doc_id,
					oldDocLines: doc?.lines
					newDocLines: lines
					rev: oldRev
				}, "updating doc lines"
				MongoManager.upsertIntoDocCollection project_id, doc_id, lines, (error)->
					return callback(callback) if error?
					callback null, true,  oldRev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc to delete: #{project_id}/#{doc_id}") if !doc?
			MongoManager.upsertIntoDocCollection project_id, doc_id, doc.lines, (error) ->
				return callback(error) if error?
				MongoManager.markDocAsDeleted doc_id, (error) ->
					return callback(error) if error?
					callback()
