{db, ObjectId} = require "./app/coffee/mongojs"
ConversionManager = require "./app/coffee/ConversionManager"

doc_id = process.argv.pop()
console.log "DOC ID", doc_id

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
	ConversionManager.convertOldestRawUpdate doc_id, (error, converted) ->
		throw error if error?
		if converted
			next()
		else
			done()
		
		
