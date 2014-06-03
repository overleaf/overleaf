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

	getAllDocs: (project_id, callback = (error, docs) ->) ->
		MongoManager.findProject project_id, (error, project) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project: #{project_id}") if !project?
			DocManager.findAllDocsInProject project, (error, docs) ->
				return callback(error) if error?
				return callback null, docs

	updateDoc: (project_id, doc_id, lines, callback = (error, modified, rev) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc, mongoPath) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc: #{project_id}/#{doc_id}") if !doc?

			if _.isEqual(doc.lines, lines)
				logger.log {
					project_id: project_id, doc_id: doc_id, rev: doc.rev
				}, "doc lines have not changed"
				return callback null, false, doc.rev
			else
				logger.log {
					project_id: project_id
					doc_id: doc_id,
					oldDocLines: doc.lines
					newDocLines: lines
					rev: doc.rev
				}, "updating doc lines"
				MongoManager.updateDoc project_id, mongoPath, lines, (error) ->
					return callback(error) if error?
					callback null, true, doc.rev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc: #{project_id}/#{doc_id}") if !doc?
			MongoManager.insertDoc project_id, doc_id, { lines: doc.lines, deleted: true }, (error) ->
				return callback(error) if error?
				callback()

	findAllDocsInProject: (project, callback = (error, docs) ->) ->
		callback null, @_findAllDocsInFolder project.rootFolder[0]

	findDocInProject: (project, doc_id, callback = (error, doc, mongoPath) ->) ->
		result = @_findDocInFolder project.rootFolder[0], doc_id, "rootFolder.0"
		if result?
			callback null, result.doc, result.mongoPath
		else
			callback null, null, null

	_findDocInFolder: (folder = {}, doc_id, currentPath) ->
		for doc, i in folder.docs or []
			if doc._id? and doc._id.toString() == doc_id.toString()
				return {
					doc: doc
					mongoPath: "#{currentPath}.docs.#{i}"
				}

		for childFolder, i in folder.folders or []
			result = @_findDocInFolder childFolder, doc_id, "#{currentPath}.folders.#{i}"
			return result if result?

		return null

	_findAllDocsInFolder: (folder = {}) ->
		docs = folder.docs or []
		for childFolder in folder.folders or []
			docs = docs.concat @_findAllDocsInFolder childFolder
		return docs

