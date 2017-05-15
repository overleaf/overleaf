RangesTracker = require "./RangesTracker"
logger = require "logger-sharelatex"

module.exports = RangesManager =
	MAX_COMMENTS: 500
	MAX_CHANGES: 2000

	applyUpdate: (project_id, doc_id, entries = {}, updates = [], newDocLines, callback = (error, new_entries) ->) ->
		{changes, comments} = entries
		rangesTracker = new RangesTracker(changes, comments)
		for update in updates
			rangesTracker.track_changes = !!update.meta.tc
			if !!update.meta.tc
				rangesTracker.setIdSeed(update.meta.tc)
			for op in update.op
				try
					rangesTracker.applyOp(op, { user_id: update.meta?.user_id })
				catch error
					return callback(error)
		
		if rangesTracker.changes?.length > RangesManager.MAX_CHANGES or rangesTracker.comments?.length > RangesManager.MAX_COMMENTS
			return callback new Error("too many comments or tracked changes")

		try
			# This is a consistency check that all of our ranges and
			# comments still match the corresponding text
			rangesTracker.validate(newDocLines.join("\n"))
		catch error
			logger.error {err: error, project_id, doc_id, newDocLines, updates}, "error validating ranges"
			return callback(error)

		response = RangesManager._getRanges rangesTracker
		logger.log {project_id, doc_id, changesCount: response.changes?.length, commentsCount: response.comments?.length}, "applied updates to ranges"
		callback null, response

	acceptChanges: (change_ids, ranges, callback = (error, ranges) ->) ->
		{changes, comments} = ranges
		logger.log "accepting #{ change_ids.length } changes in ranges"
		rangesTracker = new RangesTracker(changes, comments)
		rangesTracker.removeChangeIds(change_ids)
		response = RangesManager._getRanges(rangesTracker)
		callback null, response

	deleteComment: (comment_id, ranges, callback = (error, ranges) ->) ->
		{changes, comments} = ranges
		logger.log {comment_id}, "deleting comment in ranges"
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