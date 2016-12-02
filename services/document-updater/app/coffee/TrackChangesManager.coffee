ChangesTracker = require "./ChangesTracker"

module.exports = TrackChangesManager =
	applyUpdate: (project_id, doc_id, entries = {}, updates = [], callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		changesTracker = new ChangesTracker(changes, comments)
		for update in updates
			changesTracker.track_changes = !!update.meta.tc
			for op in update.op
				changesTracker.applyOp(op, { user_id: update.meta?.user_id })
		{changes, comments} = changesTracker
		callback null, {changes, comments}