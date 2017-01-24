DocumentUpdaterHandler = require "../DocumentUpdater/DocumentUpdaterHandler"
DocstoreManager = require "../Docstore/DocstoreManager"
UserInfoManager = require "../User/UserInfoManager"
async = require "async"

module.exports = RangesManager =
	getAllRanges: (project_id, callback = (error, docs) ->) ->
		DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
			return callback(error) if error?
			DocstoreManager.getAllRanges project_id, callback
	
	getAllChangesUsers: (project_id, callback = (error, users) ->) ->
		user_ids = {}
		RangesManager.getAllRanges project_id, (error, docs) ->
			return callback(error) if error?
			jobs = []
			for doc in docs
				for change in doc.ranges?.changes or []
					user_ids[change.metadata.user_id] = true
			
			async.mapSeries Object.keys(user_ids), (user_id, cb) ->
				UserInfoManager.getPersonalInfo user_id, cb
			, callback