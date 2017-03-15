MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
DocArchive = require "./DocArchiveManager"
RangeManager = require "./RangeManager"

module.exports = DocManager =
	

	# TODO: For historical reasons, the doc version is currently stored in the docOps
	# collection (which is all that this collection contains). In future, we should
	# migrate this version property to be part of the docs collection, to guarantee
	# consitency between lines and version when writing/reading, and for a simpler schema.
	_getDoc: (project_id, doc_id, filter = {}, callback = (error, doc) ->) ->
		if filter.inS3 != true
			return callback("must include inS3 when getting doc")

		MongoManager.findDoc project_id, doc_id, filter, (err, doc)->
			if err?
				return callback(err)
			else if !doc?
				return callback new Errors.NotFoundError("No such doc: #{doc_id} in project #{project_id}")
			else if doc?.inS3
				DocArchive.unarchiveDoc project_id, doc_id, (err)->
					if err?
						logger.err err:err, project_id:project_id, doc_id:doc_id, "error unarchiving doc"
						return callback(err)
					DocManager._getDoc project_id, doc_id, filter, callback
			else
				if filter.version
					MongoManager.getDocVersion doc_id, (error, version) ->
						return callback(error) if error?
						doc.version = version
						callback err, doc
				else
					callback err, doc

	checkDocExists: (project_id, doc_id, callback = (err, exists)->)->
		DocManager._getDoc project_id, doc_id, {_id:1, inS3:true}, (err, doc)->
			if err?
				return callback(err)
			callback(err, doc?)

	getFullDoc: (project_id, doc_id, callback = (err, doc)->)->
		DocManager._getDoc project_id, doc_id, {lines: true, rev: true, deleted: true, version: true, ranges: true, inS3:true}, (err, doc)->
			if err? 
				return callback(err)
			callback(err, doc)


	getDocLines: (project_id, doc_id, callback = (err, doc)->)->
		DocManager._getDoc project_id, doc_id, {lines:true, inS3:true}, (err, doc)->
			if err?
				return callback(err)
			callback(err, doc)

	getAllNonDeletedDocs: (project_id, filter, callback = (error, docs) ->) ->
		DocArchive.unArchiveAllDocs project_id, (error) ->
			if error?
				return callback(error)
			MongoManager.getProjectsDocs project_id, {include_deleted: false}, filter, (error, docs) ->
				if err?
					return callback(error)
				else if !docs?
					return callback new Errors.NotFoundError("No docs for project #{project_id}")
				else
					return callback(null, docs)

	updateDoc: (project_id, doc_id, lines, version, ranges, callback = (error, modified, rev) ->) ->
		if !lines? or !version? or !ranges?
			return callback(new Error("no lines, version or ranges provided"))
	
		DocManager._getDoc project_id, doc_id, {version: true, rev: true, lines: true, version: true, ranges: true, inS3:true}, (err, doc)->
			if err? and !(err instanceof Errors.NotFoundError)
				logger.err project_id: project_id, doc_id: doc_id, err:err, "error getting document for update"
				return callback(err)
			
			ranges = RangeManager.jsonRangesToMongo(ranges)

			if !doc?
				# If the document doesn't exist, we'll make sure to create/update all parts of it.
				updateLines = true
				updateVersion = true
				updateRanges = true
			else
				updateLines = not _.isEqual(doc.lines, lines)
				updateVersion = (doc.version != version)
				updateRanges = RangeManager.shouldUpdateRanges(doc.ranges, ranges)
			
			modified = false
			rev = doc?.rev || 0

			updateLinesAndRangesIfNeeded = (cb) ->
				if updateLines or updateRanges
					update = {}
					if updateLines
						update.lines = lines
					if updateRanges
						update.ranges = ranges
					logger.log { project_id, doc_id, oldDoc: doc, update: update }, "updating doc lines and ranges"
					
					modified = true
					rev += 1 # rev will be incremented in mongo by MongoManager.upsertIntoDocCollection
					MongoManager.upsertIntoDocCollection project_id, doc_id, update, cb
				else
					logger.log { project_id, doc_id, }, "doc lines have not changed - not updating"
					cb()
			
			updateVersionIfNeeded = (cb) ->
				if updateVersion
					logger.log { project_id, doc_id, oldVersion: doc?.version, newVersion: version }, "updating doc version"
					modified = true
					MongoManager.setDocVersion doc_id, version, cb
				else
					logger.log { project_id, doc_id, version }, "doc version has not changed - not updating"
					cb()
			
			updateLinesAndRangesIfNeeded (error) ->
				return callback(error) if error?
				updateVersionIfNeeded (error) ->
					return callback(error) if error?
					callback null, modified, rev

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.checkDocExists project_id, doc_id, (error, exists) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc to delete: #{project_id}/#{doc_id}") if !exists
			MongoManager.markDocAsDeleted project_id, doc_id, callback

