MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"

module.exports = DocManager =
	getDoc: (project_id, doc_id, callback = (error, doc, mongoPath) ->) ->
		MongoManager.findProject project_id, (error, project) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project: #{project_id}") if !project?
			DocManager.findDocInProject project, doc_id, (error, doc, mongoPath) ->
				return callback(error) if error?
				return callback new Errors.NotFoundError("No such doc: #{project_id}") if !doc?
				return callback null, doc, mongoPath

	updateDoc: (project_id, doc_id, lines, callback = (error, modified) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc, mongoPath) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc: #{project_id}/#{doc_id}") if !doc?

			if _.isEqual(doc.lines, lines)
				logger.log {
					project_id: project_id, doc_id: doc_id, rev: doc.rev
				}, "doc lines have not changed"
				return callback null, false
			else
				logger.log {
					project_id: project_id, doc_id: doc_id, oldDocLines: doc.lines, newDocLines: lines, rev: doc.rev
				}, "updating doc lines"
				MongoManager.updateDoc project_id, mongoPath, lines, (error) ->
					return callback(error) if error?
					callback null, true

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc: #{project_id}/#{doc_id}") if !doc?
			MongoManager.insertDoc project_id, doc_id, { lines: doc.lines, deleted: true }, (error) ->
				return callback(error) if error?
				callback()

	findDocInProject: (project, doc_id, callback = (error, doc, mongoPath) ->) ->
		result = @_findDocInFolder project.rootFolder[0], doc_id, "rootFolder.0"
		if result?
			callback null, result.doc, result.mongoPath
		else
			callback null, null, null

	_findDocInFolder: (folder, doc_id, currentPath) ->
		for doc, i in folder.docs or []
			if doc._id.toString() == doc_id.toString()
				return {
					doc: doc
					mongoPath: "#{currentPath}.docs.#{i}"
				}

		for childFolder, i in folder.folders or []
			result = @_findDocInFolder childFolder, doc_id, "#{currentPath}.folders.#{i}"
			return result if result?

		return null