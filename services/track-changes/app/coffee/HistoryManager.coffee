{db, ObjectId} = require "./mongojs"
UpdateCompressor = require "./UpdateCompressor"
logger = require "logger-sharelatex"

module.exports = HistoryManager =
	getLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id.toString()))
			.sort(timestamp: -1)
			.limit(1)
			.toArray (error, compressedUpdates) ->
				return callback(error) if error?
				return callback null, compressedUpdates[0] or null

	deleteCompressedUpdate: (id, callback = (error) ->) ->
		db.docHistory.delete({ _id: ObjectId(id.toString()) }, callback)

	popLastCompressedUpdate: (doc_id, callback = (error, update) ->) ->
		HistoryManager.getLastCompressedUpdate doc_id, (error, update) ->
			return callback(error) if error?
			if update?
				HistoryManager.deleteCompressedUpdate update._id, (error) ->
					return callback(error) if error?
					callback null, update
			else
				callback null, null

	insertCompressedUpdates: (doc_id, docUpdates, callback = (error) ->) ->
		db.docHistory.update {
			doc_id: ObjectId(doc_id)
		}, {
			$push:
				docUpdates:
					$each: docUpdates
		}, {
			upsert: true
		}, callback

	compressAndSaveRawUpdates: (doc_id, rawUpdates, callback = (error) ->) ->
		length = rawUpdates.length
		if length == 0
			return callback()


		HistoryManager.popLastCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
			return callback(error) if error?

			compressedUpdates = UpdateCompressor.compressRawUpdates lastCompressedUpdate, rawUpdates

			HistoryManager.insertCompressedUpdates doc_id, compressedUpdates, (error) ->
				return callback(error) if error?
				logger.log doc_id: doc_id, rawUpdatesLength: length, compressedUpdatesLength: compressedUpdates.length, "compressed doc updates"
				callback()

