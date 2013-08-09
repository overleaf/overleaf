{db, ObjectId} = require "./mongojs"
ConcatManager = require "./ConcatManager"

module.exports = ConversionManager =
	OPS_TO_LEAVE: 10

	removeLatestCompressedUpdate: (doc_id, callback = (error) ->) ->
		db.docHistory.update { doc_id: ObjectId(doc_id) }, { $pop: { docOps: 1 } }, callback

	getLatestCompressedUpdate: (doc_id, callback = (error) ->) ->
		db.docHistory.find { doc_id: ObjectId(doc_id) }, { docOps: { $slice: -1 } }, (error, history) ->
			return callback(error) if error?
			history = history[0] or { docOps: [] }
			callback null, history.docOps.slice(-1)[0]

	insertCompressedUpdates: (doc_id, updates, callback = (error) ->) ->
		db.docHistory.update { doc_id: ObjectId(doc_id) }, { $push: { docOps: { $each: updates } } }, { upsert: true }, callback

	trimLastRawUpdate: (doc_id, tailVersion, callback = (error) ->) ->
		db.docOps.update { doc_id: ObjectId(doc_id) }, { $pop: { docOps: -1 }, $set: { tailVersion: tailVersion + 1 } }, callback

	getLastRawUpdateAndVersion: (doc_id, callback = (error, update, currentVersion, tailVersion) ->) ->
		db.docOps.find { doc_id: ObjectId(doc_id) }, { version: true, tailVersion: true, docOps: { $slice: 1 } }, (error, docs) ->
			return callback(error) if error?
			return callback(new Error("doc not found")) if docs.length == 0
			doc = docs[0]
			callback null, doc.docOps[0], doc.version, doc.tailVersion or 0

	convertOldestRawUpdate: (doc_id, callback = (error, converted) ->) ->
		ConversionManager.getLastRawUpdateAndVersion doc_id, (error, rawUpdate, currentVersion, tailVersion) ->
			return callback(error) if error?

			rawUpdates = ConcatManager.normalizeUpdate(rawUpdate)

			if currentVersion - tailVersion > ConcatManager.OPS_TO_LEAVE
				ConversonManager.getLatestCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
					return callback(error) if error?

					removeAndModifyPreviousCompressedUpdate = (callback, compressedUpdates) ->
						if lastCompressedUpdate?
							compressedUpdates = [lastCompressedUpdate]
							for rawUpdate in rawUpdates
								lastCompressedUpdate = compressedUpdates.pop()
								compressedUpdates = compressedUpdates.concat ConcatManager.concatTwoUpdates lastCompressedUpdate, rawUpdate
							ConversionManager.removeLatestCompressedUpdate doc_id, (error) ->
								return callback(error) if error?
								callback null, compressUpdates
						else
							callback null, rawUpdates
						
					removeAndModifyPreviousCompressedUpdate (error, newCompressedUpdates) ->
						return callback(error) if error?
						ConversionManager.insertCompressedUpdates doc_id, newCompressedUpdates, (error) ->
							return callback(error) if error?
							ConversionManager.trimLastRawUpdate doc_id, tailVersion, (error) ->
								return callback(error) if error?
								console.log "Pushed op", tailVersion
								callback null, true

			else
				console.log "Up to date"
				callback null, false
