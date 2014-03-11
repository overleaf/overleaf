UpdatesManager = require "./UpdatesManager"
DiffManager = require "./DiffManager"
RestoreManager = require "./RestoreManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	flushUpdatesWithLock: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		logger.log doc_id: doc_id, "compressing doc history"
		UpdatesManager.processUncompressedUpdatesWithLock doc_id, (error) ->
			return next(error) if error?
			res.send 204

	getDiff: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id

		if req.query.from?
			from = parseInt(req.query.from, 10)
		else
			from = null
		if req.query.to?
			to = parseInt(req.query.to, 10)
		else
			to = null

		logger.log project_id, doc_id: doc_id, from: from, to: to, "getting diff"
		DiffManager.getDiff project_id, doc_id, from, to, (error, diff) ->
			return next(error) if error?
			res.send JSON.stringify(diff: diff)

	getUpdates: (req, res, next = (error) ->) ->
		doc_id = req.params.doc_id
		project_id = req.params.project_id

		if req.query.to?
			to = parseInt(req.query.to, 10)
		if req.query.limit?
			limit = parseInt(req.query.limit, 10)

		UpdatesManager.getUpdatesWithUserInfo doc_id, to: to, limit: limit, (error, updates) ->
			return next(error) if error?
			res.send JSON.stringify updates: HttpController._buildUpdatesView(updates)

	TIME_BETWEEN_DISTINCT_UPDATES: fiveMinutes = 5 * 60 * 1000
	_buildUpdatesView: (updates) ->
		view = []
		for update in updates.slice().reverse()
			lastUpdate = view[view.length - 1]
			if lastUpdate and update.meta.start_ts - lastUpdate.meta.end_ts < @TIME_BETWEEN_DISTINCT_UPDATES
				if update.meta.user?
					userExists = false
					for user in lastUpdate.meta.users
						if user.id == update.meta.user.id
							userExists = true
							break
					if !userExists
						lastUpdate.meta.users.push update.meta.user
				lastUpdate.meta.start_ts = Math.min(lastUpdate.meta.start_ts, update.meta.start_ts)
				lastUpdate.meta.end_ts   = Math.max(lastUpdate.meta.end_ts, update.meta.end_ts)
				lastUpdate.toV = update.v
			else
				newUpdate =
					meta:
						users: []
						start_ts: update.meta.start_ts
						end_ts: update.meta.end_ts
					fromV: update.v
					toV: update.v

				if update.meta.user?
					newUpdate.meta.users.push update.meta.user

				view.push newUpdate

		return view.reverse()

	restore: (req, res, next = (error) ->) ->
		{doc_id, project_id, version} = req.params
		user_id = req.headers["x-user-id"]
		version = parseInt(version, 10)
		RestoreManager.restoreToBeforeVersion project_id, doc_id, version, user_id, (error) ->
			return next(error) if error?
			res.send 204
