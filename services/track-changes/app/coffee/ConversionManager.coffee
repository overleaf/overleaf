{db, ObjectId} = require "./mongojs"
ConcatManager = require "./ConcatManager"
logger = require "logger-sharelatex"

module.exports = ConversionManager =
	OPS_TO_LEAVE: 100

	popLatestCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory.findAndModify
			query: { doc_id: ObjectId(doc_id) }
			fields: { docOps: { $slice: -1 } }
			update: { $pop: { docOps: 1 } }
		, (error, history = { docOps: [] }) ->
			return callback(error) if error?
			callback null, history.docOps[0]

	insertCompressedUpdates: (doc_id, updates, callback = (error) ->) ->
		db.docHistory.update { doc_id: ObjectId(doc_id) }, { $push: { docOps: { $each: updates } } }, { upsert: true }, callback

	popOldRawUpdates: (doc_id, callback = (error, updates) ->) ->
		db.docOps.find { doc_id: ObjectId(doc_id) }, { version: true, tailVersion: true }, (error, docs) ->
			return callback(error) if error?
			return callback(new Error("doc not found")) if docs.length == 0
			doc = docs[0]
			currentVersion = doc.version
			tailVersion = doc.tailVersion or 0
			if currentVersion - tailVersion > ConversionManager.OPS_TO_LEAVE
				db.docOps.findAndModify
					query:
						doc_id: ObjectId(doc_id)
						version: currentVersion
					update:
						$push:
							docOps:
								$each: []
								$slice: - ConversionManager.OPS_TO_LEAVE
						$set:
							tailVersion: currentVersion - ConversionManager.OPS_TO_LEAVE
					fields:
						docOps:
							$slice: currentVersion - tailVersion - ConversionManager.OPS_TO_LEAVE
				, (error, doc) ->
					return callback(error) if error?
					if !doc?
						# Version was modified since so try again
						return ConversionManager.popOldRawUpdates doc_id, callback
					else
						return callback null, doc.docOps
						
			else
				callback null, []

	convertOldRawUpdates: (doc_id, callback = (error) ->) ->
		ConversionManager.popOldRawUpdates doc_id, (error, rawUpdates) ->
			return callback(error) if error?

			length = rawUpdates.length

			normalizedRawUpdates = []
			for rawUpdate in rawUpdates
				normalizedRawUpdates = normalizedRawUpdates.concat ConcatManager.normalizeUpdate(rawUpdate)
			rawUpdates = normalizedRawUpdates

			ConversionManager.popLatestCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
				return callback(error) if error?

				if !lastCompressedUpdate?
					lastCompressedUpdate = rawUpdates.shift()

				if !lastCompressedUpdate?
					# No saved versions, no raw updates, nothing to do
					return callback()

				uncompressedUpdates = [lastCompressedUpdate].concat rawUpdates
				compressedUpdates = ConcatManager.compressUpdates uncompressedUpdates

				ConversionManager.insertCompressedUpdates doc_id, compressedUpdates, (error) ->
					return callback(error) if error?
					logger.log doc_id: doc_id, rawOpsLength: length, compressedOpsLength: compressedUpdates.length, "compressed doc ops"
					callback()

