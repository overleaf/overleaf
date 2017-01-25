RangesTracker = require "./RangesTracker"
logger = require "logger-sharelatex"

module.exports = RangesManager =
	MAX_COMMENTS: 500
	MAX_CHANGES: 500

	applyUpdate: (project_id, doc_id, entries = {}, updates = [], callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		logger.log {changes, comments, updates}, "applying updates to ranges"
		rangesTracker = new RangesTracker(changes, comments)
		for update in updates
			rangesTracker.track_changes = !!update.meta.tc
			if !!update.meta.tc
				rangesTracker.setIdSeed(update.meta.tc)
			for op in update.op
				rangesTracker.applyOp(op, { user_id: update.meta?.user_id })
		
		if rangesTracker.changes?.length > RangesManager.MAX_CHANGES or rangesTracker.comments?.length > RangesManager.MAX_COMMENTS
			return callback new Error("too many comments or tracked changes")

		response = RangesManager._getRanges rangesTracker
		logger.log {response}, "applied updates to ranges"
		callback null, response

	acceptChange: (change_id, ranges, callback = (error, ranges) ->) ->
		{changes, comments} = ranges
		logger.log {changes, comments, change_id}, "accepting change in ranges"
		rangesTracker = new RangesTracker(changes, comments)
		rangesTracker.removeChangeId(change_id)
		response = RangesManager._getRanges(rangesTracker)
		callback null, response

	deleteComment: (comment_id, ranges, callback = (error, ranges) ->) ->
		{changes, comments} = ranges
		logger.log {changes, comments, comment_id}, "deleting comment in ranges"
		rangesTracker = new RangesTracker(changes, comments)
		rangesTracker.removeCommentId(comment_id)
		response = RangesManager._getRanges(rangesTracker)
		callback null, response
	
	_getRanges: (rangesTracker) ->
		# Return the minimal data structure needed, since most documents won't have any
		# changes or comments
		response = {}
		if rangesTracker.changes?.length > 0
			response ?= {}
			response.changes = rangesTracker.changes
		if rangesTracker.comments?.length > 0
			response ?= {}
			response.comments = rangesTracker.comments
		return response