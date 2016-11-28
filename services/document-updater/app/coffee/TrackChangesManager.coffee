ChangesTracker = require "./ChangesTracker"

module.exports = TrackChangesManager =
	applyUpdate: (project_id, doc_id, entries = {}, updates = [], track_changes, callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		changesTracker = new ChangesTracker(changes, comments)
		changesTracker.track_changes = track_changes
		for update in updates
			for op in update.op
				changesTracker.applyOp(op, { user_id: update.meta?.user_id,  })
		{changes, comments} = changesTracker
		callback null, {changes, comments}