DocumentUpdaterManager = require "./DocumentUpdaterManager"
DiffManager = require "./DiffManager"
logger = require "logger-sharelatex"

module.exports = RestoreManager =
	restoreToBeforeVersion: (project_id, doc_id, version, user_id, callback = (error) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, version: version, user_id: user_id, "restoring document"
		DiffManager.getDocumentBeforeVersion project_id, doc_id, version, (error, content) ->
			return callback(error) if error?
			DocumentUpdaterManager.setDocument project_id, doc_id, content, user_id, (error) ->
				return callback(error) if error?
				callback()
