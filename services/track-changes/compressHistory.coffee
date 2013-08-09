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
				ConversionManager.convertOldRawUpdates doc_id, (error) ->
					return callback(error) if error?
					console.log doc_id, "DONE"
					callback()
	async.series jobs, (error) ->
		throw error if error?
		process.exit()
		
		
