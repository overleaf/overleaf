MongoManager = require "./MongoManager"

module.exports = DocManager =
	getDoc: (project_id, doc_id, callback = (error, doc) ->) ->
		MongoManager.findProject project_id, (error, project) ->
			return callback(error) if error?
			return callback null, null if !project?
			DocManager.findDocInProject project, doc_id, (error, doc) ->
				return callback(error) if error?
				return callback null, doc

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