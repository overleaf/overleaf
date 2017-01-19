_ = require "underscore"
{ObjectId} = require("./mongojs")

module.exports = RangeManager =
	shouldUpdateRanges: (doc_ranges, incoming_ranges) ->
		if !incoming_ranges?
			throw new Error("expected incoming_ranges")

		# If the ranges are empty, we don't store them in the DB, so set
		# doc_ranges to an empty object as default, since this is was the 
		# incoming_ranges will be for an empty range set.
		if !doc_ranges?
			doc_ranges = {}

		return not _.isEqual(doc_ranges, incoming_ranges)
	
	jsonRangesToMongo: (ranges) ->
		return null if !ranges?
		for change in ranges.changes or []
			change.id = @_safeObjectId(change.id)
			if change.metadata?.ts?
				change.metadata.ts = new Date(change.metadata.ts)
			if change.metadata?.user_id?
				change.metadata.user_id = @_safeObjectId(change.metadata.user_id)
		for comment in ranges.comments or []
			comment.id = @_safeObjectId(comment.id)
			if comment.op?.t?
				comment.op.t = @_safeObjectId(comment.op.t)
		return ranges
	
	_safeObjectId: (data) ->
		try
			return ObjectId(data)
		catch
			return data