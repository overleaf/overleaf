RangesTracker = require "./RangesTracker"
logger = require "logger-sharelatex"

module.exports = RangesManager =
	applyUpdate: (project_id, doc_id, entries = {}, updates = [], callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		logger.log {changes, comments, updates}, "appliyng updates to ranges"
		rangesTracker = new RangesTracker(changes, comments)
		for update in updates
			rangesTracker.track_changes = !!update.meta.tc
			for op in update.op
				rangesTracker.applyOp(op, { user_id: update.meta?.user_id })
		
		# Return the minimal data structure needed, since most documents won't have any
		# changes or comments
		response = {}
		if rangesTracker.changes?.length > 0
			response ?= {}
			response.changes = rangesTracker.changes
		if rangesTracker.comments?.length > 0
			response ?= {}
			response.comments = rangesTracker.comments
		logger.log {response}, "applied updates to ranges"
		callback null, response