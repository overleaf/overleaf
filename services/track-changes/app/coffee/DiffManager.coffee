UpdatesManager = require "./UpdatesManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"
DiffGenerator = require "./DiffGenerator"
logger = require "logger-sharelatex"

module.exports = DiffManager =
	getLatestDocAndUpdates: (project_id, doc_id, fromVersion, toVersion, callback = (error, content, version, updates) ->) ->
		# retrieve the document before retreiving the updates,
		# because updates are written to mongo after the document
		DocumentUpdaterManager.getDocument project_id, doc_id, (error, content, version) ->
			return callback(error) if error?
			UpdatesManager.getDocUpdatesWithUserInfo project_id, doc_id, from: fromVersion, to: toVersion, (error, updates) ->
				return callback(error) if error?
				callback(null, content, version, updates)
	
	getDiff: (project_id, doc_id, fromVersion, toVersion, callback = (error, diff) ->) ->
		DiffManager.getDocumentBeforeVersion project_id, doc_id, fromVersion, (error, startingContent, updates) ->
			if error?
				if error.message == "broken-history"
					return callback(null, "history unavailable")
				else
					return callback(error)

			updatesToApply = []
			for update in updates.slice().reverse()
				if update.v <= toVersion
					updatesToApply.push update

			try
				diff = DiffGenerator.buildDiff startingContent, updatesToApply
			catch e
				return callback(e)
			
			callback(null, diff)

	getDocumentBeforeVersion: (project_id, doc_id, version, callback = (error, document, rewoundUpdates) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, version: version, "getting document before version"
		DiffManager.getLatestDocAndUpdates project_id, doc_id, version, null, (error, content, version, updates) ->
			return callback(error) if error?

			# bail out if we hit a broken update
			for u in updates when u.broken
				return callback new Error "broken-history"

			# discard any updates which are ahead of this document version
			while updates[0]?.v >= version
				updates.shift()

			lastUpdate = updates[0]
			if lastUpdate? and lastUpdate.v != version - 1
				return callback new Error("latest update version, #{lastUpdate.v}, does not match doc version, #{version}")

			tryUpdates = updates.slice().reverse()

			try
				startingContent = DiffGenerator.rewindUpdates content, tryUpdates
				# tryUpdates is reversed, and any unapplied ops are marked as broken
			catch e
				return callback(e)

			callback(null, startingContent, tryUpdates)
