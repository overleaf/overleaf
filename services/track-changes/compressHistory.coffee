{db, ObjectId} = require "./app/js/mongojs"
ConcatManager = require "./app/js/ConcatManager"

doc_id = process.argv.pop()
console.log "DOC ID", doc_id

OPS_TO_LEAVE = 10

removeLatestCompressedUpdate = (doc_id, callback = (error) ->) ->
	db.docHistory.update { doc_id: ObjectId(doc_id) }, { $pop: { docOps: 1 } }, callback

getLatestCompressedUpdate = (doc_id, callback = (error) ->) ->
	db.docHistory.find { doc_id: ObjectId(doc_id) }, { docOps: { $slice: -1 } }, (error, history) ->
		return callback(error) if error?
		history = history[0] or { docOps: [] }
		callback null, history.docOps.slice(-1)[0]

insertCompressedUpdates = (doc_id, updates, callback = (error) ->) ->
	db.docHistory.update { doc_id: ObjectId(doc_id) }, { $push: { docOps: { $each: updates } } }, { upsert: true }, callback

trimLastRawUpdate = (doc_id, tailVersion, callback = (error) ->) ->
	db.docOps.update { doc_id: ObjectId(doc_id) }, { $pop: { docOps: -1 }, $set: { tailVersion: tailVersion + 1 } }, callback

done = () ->
	console.log "DONE! Here's the history:"
	db.docHistory.find { doc_id: ObjectId(doc_id) }, (error, docs) ->
		throw error if error?
		doc = docs[0]
		for update in doc.docOps
			op = update.op[0]
			if op.i?
				console.log update.meta.start_ts, update.meta.end_ts, update.meta.user_id, "INSERT", op.p, op.i
			else if op.d?
				console.log update.meta.start_ts, update.meta.end_ts, update.meta.user_id, "DELETE", op.p, op.d
		process.exit()

do next = () ->
	db.docOps.find { doc_id: ObjectId(doc_id) }, { version: true, tailVersion: true, docOps: { $slice: 1 } }, (error, docs) ->
		throw error if error?
		throw "doc not found" if docs.length < 1
		doc = docs[0]
		tailVersion = doc.tailVersion or 0
		version = doc.version

		rawUpdate = doc.docOps[0]
		rawUpdates = ConcatManager.normalizeUpdate(rawUpdate)

		if version - tailVersion > OPS_TO_LEAVE
			getLatestCompressedUpdate doc_id, (error, lastCompressedUpdate) ->
				throw error if error?
				if lastCompressedUpdate?
					compressedUpdates = [lastCompressedUpdate]
					for rawUpdate in rawUpdates
						lastCompressedUpdate = compressedUpdates.pop()
						compressedUpdates = compressedUpdates.concat ConcatManager.concatTwoUpdates lastCompressedUpdate, rawUpdate
					removeLatestCompressedUpdate doc_id, (error) ->
						throw error if error?
						insertCompressedUpdates doc_id, compressedUpdates, (error) ->
							throw error if error?
							trimLastRawUpdate doc_id, tailVersion, (error) ->
								throw error if error?
								console.log "Pushed compressed op"
								next()
				else
					insertCompressedUpdates doc_id, rawUpdates, (error) ->
						trimLastRawUpdate doc_id, tailVersion, (error) ->
							throw error if error?
							console.log "Pushed first op"
							next()
		else
			console.log "Up to date"
			done()

		
