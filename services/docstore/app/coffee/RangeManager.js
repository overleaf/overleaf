/* eslint-disable
    camelcase,
    no-return-assign,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RangeManager;
const _ = require("underscore");
const {ObjectId} = require("./mongojs");

module.exports = (RangeManager = {
	shouldUpdateRanges(doc_ranges, incoming_ranges) {
		if ((incoming_ranges == null)) {
			throw new Error("expected incoming_ranges");
		}

		// If the ranges are empty, we don't store them in the DB, so set
		// doc_ranges to an empty object as default, since this is was the 
		// incoming_ranges will be for an empty range set.
		if ((doc_ranges == null)) {
			doc_ranges = {};
		}

		return !_.isEqual(doc_ranges, incoming_ranges);
	},
	
	jsonRangesToMongo(ranges) {
		if ((ranges == null)) { return null; }
		
		const updateMetadata = function(metadata) {
			if ((metadata != null ? metadata.ts : undefined) != null) {
				metadata.ts = new Date(metadata.ts);
			}
			if ((metadata != null ? metadata.user_id : undefined) != null) {
				return metadata.user_id = RangeManager._safeObjectId(metadata.user_id);
			}
		};
		
		for (const change of Array.from(ranges.changes || [])) {
			change.id = RangeManager._safeObjectId(change.id);
			updateMetadata(change.metadata);
		}
		for (const comment of Array.from(ranges.comments || [])) {
			comment.id = RangeManager._safeObjectId(comment.id);
			if ((comment.op != null ? comment.op.t : undefined) != null) {
				comment.op.t = RangeManager._safeObjectId(comment.op.t);
			}
			updateMetadata(comment.metadata);
		}
		return ranges;
	},
	
	_safeObjectId(data) {
		try {
			return ObjectId(data);
		} catch (error) {
			return data;
		}
	}
});