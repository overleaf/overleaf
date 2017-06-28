UpdatesManager = require "./UpdatesManager"
DocumentUpdaterManager = require "./DocumentUpdaterManager"
DiffGenerator = require "./DiffGenerator"
logger = require "logger-sharelatex"

module.exports = DiffManager =
	getLatestDocAndUpdates: (project_id, doc_id, fromVersion, callback = (error, content, version, updates) ->) ->
		# Get updates last, since then they must be ahead and it
		# might be possible to rewind to the same version as the doc.
		DocumentUpdaterManager.getDocument project_id, doc_id, (error, content, version) ->
			return callback(error) if error?
			if !fromVersion? # If we haven't been given a version, just return lastest doc and no updates
				return callback(null, content, version, [])
			UpdatesManager.getDocUpdatesWithUserInfo project_id, doc_id, from: fromVersion, (error, updates) ->
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

	getDocumentBeforeVersion: (project_id, doc_id, version, _callback = (error, document, rewoundUpdates) ->) ->
		# Whichever order we get the latest document and the latest updates,
		# there is potential for updates to be applied between them so that
		# they do not return the same 'latest' versions.
		# If this happens, we just retry and hopefully get them at the compatible
		# versions.
		retries = 3
		callback = (error, args...) ->
			if error?
				if error.retry and retries > 0
					logger.warn {error, project_id, doc_id, version, retries}, "retrying getDocumentBeforeVersion"
					retry()
				else
					_callback(error)
			else
				_callback(null, args...)

		do retry = () ->
			retries--
			DiffManager._tryGetDocumentBeforeVersion(project_id, doc_id, version, callback)

	_tryGetDocumentBeforeVersion: (project_id, doc_id, version, callback = (error, document, rewoundUpdates) ->) ->
		logger.log project_id: project_id, doc_id: doc_id, version: version, "getting document before version"
		DiffManager.getLatestDocAndUpdates project_id, doc_id, version, (error, content, version, updates) ->
			return callback(error) if error?

			# bail out if we hit a broken update
			for u in updates when u.broken
				return callback new Error "broken-history"

			# discard any updates which are ahead of this document version
			while updates[0]?.v >= version
				updates.shift()

			lastUpdate = updates[0]
			if lastUpdate? and lastUpdate.v != version - 1
				error = new Error("latest update version, #{lastUpdate.v}, does not match doc version, #{version}")
				error.retry = true
				return callback error
			
			logger.log {docVersion: version, lastUpdateVersion: lastUpdate?.v, updateCount: updates.length}, "rewinding updates"

			tryUpdates = updates.slice().reverse()

			try
				startingContent = DiffGenerator.rewindUpdates content, tryUpdates
				# tryUpdates is reversed, and any unapplied ops are marked as broken
			catch e
				return callback(e)

			callback(null, startingContent, tryUpdates)
