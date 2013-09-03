{db, ObjectId} = require "./mongojs"
HistoryBuilder = require "./HistoryBuilder"
logger = require "logger-sharelatex"

module.exports = ConversionManager =
	OPS_TO_LEAVE: 100

	popLastCompressedOp: (doc_id, callback = (error, op) ->) ->
		db.docHistory.findAndModify
			query: { doc_id: ObjectId(doc_id) }
			fields: { docOps: { $slice: -1 } }
			update: { $pop: { docOps: 1 } }
		, (error, history = { docOps: [] }) ->
			return callback(error) if error?
			callback null, history.docOps[0]

	insertCompressedOps: (doc_id, docOps, callback = (error) ->) ->
		db.docHistory.update {
			doc_id: ObjectId(doc_id)
		}, {
			$push:
				docOps:
					$each: docOps
		}, {
			upsert: true
		}, callback

	convertAndSaveRawOps: (doc_id, rawOps, callback = (error) ->) ->
		length = rawOps.length
		if length == 0
			return callback()


		ConversionManager.popLastCompressedOp doc_id, (error, lastCompressedOp) ->
			return callback(error) if error?

			if !lastCompressedOp?
				rawOps = rawOps.slice(0) # Clone so we can modify in place
				lastCompressedOp = rawOps.shift()

			uncompressedOps = [lastCompressedOp].concat rawOps
			compressedOps = HistoryBuilder.compressOps uncompressedOps

			ConversionManager.insertCompressedOps doc_id, compressedOps, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, rawOpsLength: length, compressedOpsLength: compressedOps.length, "compressed doc ops"
				callback()

