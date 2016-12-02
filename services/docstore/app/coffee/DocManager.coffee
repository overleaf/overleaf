MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
DocArchive = require "./DocArchiveManager"

module.exports = DocManager =
	# TODO: For historical reasons, the doc version is currently stored in the docOps
	# collection (which is all that this collection contains). In future, we should
	# migrate this version property to be part of the docs collection, to guarantee
	# consitency between lines and version when writing/reading, and for a simpler schema.
	getDoc: (project_id, doc_id, filter = { version: false }, callback = (error, doc) ->) ->
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
					DocManager.getDoc project_id, doc_id, filter, callback
			else
				if filter.version
					MongoManager.getDocVersion doc_id, (error, version) ->
						return callback(error) if error?
						doc.version = version
						callback err, doc
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

	updateDoc: (project_id, doc_id, lines, version, callback = (error, modified, rev) ->) ->
		DocManager.getDoc project_id, doc_id, {version: true}, (err, doc)->
			if err? and !(err instanceof Errors.NotFoundError)
				logger.err project_id: project_id, doc_id: doc_id, err:err, "error getting document for update"
				return callback(err)

			isNewDoc = lines.length == 0
			linesAreSame =  _.isEqual(doc?.lines, lines)
			if version?
				versionsAreSame = (doc?.version == version)
			else
				versionsAreSame = true

			if linesAreSame and versionsAreSame and !isNewDoc
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
					oldVersion: doc?.version
					newVersion: version
				}, "updating doc lines"
				MongoManager.upsertIntoDocCollection project_id, doc_id, lines, (error)->
					return callback(callback) if error?
					# TODO: While rolling out this code, setting the version via the docstore is optional,
					# so if it hasn't been passed, just ignore it. Once the docupdater has totally
					# handed control of this to the docstore, we can assume it will always be passed
					# and an error guard on it not being set instead.
					if version?
						MongoManager.setDocVersion doc_id, version, (error) ->
							return callback(error) if error?
							callback null, true, oldRev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc
					else
						callback null, true, oldRev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, { version: false }, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc to delete: #{project_id}/#{doc_id}") if !doc?
			MongoManager.markDocAsDeleted project_id, doc_id, callback
