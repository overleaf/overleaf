HistoryManager = require "./HistoryManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"
MongoManager = require "./MongoManager"
DiffGenerator = require "./DiffGenerator"

module.exports = DiffManager =
	getLatestDocAndUpdates: (project_id, doc_id, fromDate, toDate, callback = (error, lines, version, updates) ->) ->
		HistoryManager.processUncompressedUpdatesWithLock doc_id, (error) ->
			return callback(error) if error?
			DocumentUpdaterManager.getDocument project_id, doc_id, (error, lines, version) ->
				return callback(error) if error?
				MongoManager.getUpdatesBetweenDates doc_id, fromDate, toDate, (error, updates) ->
					return callback(error) if error?
					callback(null, lines, version, updates)
	
	getDiff: (project_id, doc_id, fromDate, toDate, callback = (error, diff) ->) ->
		DiffManager.getLatestDocAndUpdates project_id, doc_id, fromDate, null, (error, lines, version, updates) ->
			return callback(error) if error?
			lastUpdate = updates[updates.length - 1]
			if lastUpdate? and lastUpdate.v != version
				return callback new Error("latest update version, #{lastUpdate.v}, does not match doc version, #{version}")
			

			updatesToApply = []
			for update in updates
				if update.meta.end_ts <= toDate
					updatesToApply.push update

			try
				startingContent = DiffGenerator.rewindUpdates lines.join("\n"), updates
				diff = DiffGenerator.buildDiff startingContent, updatesToApply
			catch e
				return callback(e)
			
			callback(null, diff)