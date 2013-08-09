{db, ObjectId} = require "./app/coffee/mongojs"
ConversionManager = require "./app/coffee/ConversionManager"
async = require "async"

db.docOps.find { }, { doc_id: true }, (error, docs) ->
	throw error if error?
	jobs = []
	for doc in docs
		do (doc) ->
			jobs.push (callback) ->
				doc_id = doc.doc_id.toString()
				ConversionManager.convertAllOldRawUpdates doc_id, (error) ->
					return callback(error) if error?
					console.log doc_id, "DONE"
					db.docHistory.find { doc_id: ObjectId(doc_id) }, (error, docs) ->
						return callback(error) if error?
						doc = docs[0]
						if doc?
							for update in doc.docOps
								op = update.op[0]
								if op.i?
									console.log doc_id, update.meta.start_ts, update.meta.end_ts, update.meta.user_id, "INSERT", op.p, op.i
								else if op.d?
									console.log doc_id, update.meta.start_ts, update.meta.end_ts, update.meta.user_id, "DELETE", op.p, op.d
						else
							console.log doc_id, "NO HISTORY"
						callback()
	async.series jobs, (error) ->
		throw error if error?
		process.exit()
		
		
