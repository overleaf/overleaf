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
		
		updateMetadata = (metadata) ->
			if metadata?.ts?
				metadata.ts = new Date(metadata.ts)
			if metadata?.user_id?
				metadata.user_id = RangeManager._safeObjectId(metadata.user_id)
		
		for change in ranges.changes or []
			change.id = RangeManager._safeObjectId(change.id)
			updateMetadata(change.metadata)
		for comment in ranges.comments or []
			comment.id = RangeManager._safeObjectId(comment.id)
			if comment.op?.t?
				comment.op.t = RangeManager._safeObjectId(comment.op.t)
			updateMetadata(comment.metadata)
		return ranges
	
	_safeObjectId: (data) ->
		try
			return ObjectId(data)
		catch
			return data