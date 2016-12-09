DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
DocstoreManager = require "../Docstore/DocstoreManager"

module.exports = RangesManager =
	getAllRanges: (project_id, callback = (error, docs) ->) ->
		DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
			return callback(error) if error?
			DocstoreManager.getAllRanges project_id, callback