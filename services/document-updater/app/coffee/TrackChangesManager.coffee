ChangesTracker = require "./ChangesTracker"

module.exports = TrackChangesManager =
	applyUpdate: (project_id, doc_id, entries = {}, updates = [], callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		changesTracker = new ChangesTracker(changes, comments)
		for update in updates
			changesTracker.track_changes = !!update.meta.tc
			for op in update.op
				changesTracker.applyOp(op, { user_id: update.meta?.user_id })
		
		# Return the minimal data structure needed, since most documents won't have any
		# changes or comments
		response = null
		if changesTracker.changes?.length > 0
			response ?= {}
			response.changes = changesTracker.changes
		if changesTracker.comments?.length > 0
			response ?= {}
			response.comments = changesTracker.comments
		callback null, response