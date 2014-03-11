request = require "request"
rclient = require("redis").createClient() # Only works locally for now
{db, ObjectId} = require "../../../../app/js/mongojs"

module.exports = TrackChangesClient =
	flushAndGetCompressedUpdates: (doc_id, callback = (error, updates) ->) ->
		request.post {
			url: "http://localhost:3015/doc/#{doc_id}/flush"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			db.docHistory
				.find(doc_id: ObjectId(doc_id))
				.sort("meta.end_ts": 1)
				.toArray callback

	pushRawUpdates: (doc_id, updates, callback = (error) ->) ->
		rclient.rpush "UncompressedHistoryOps:#{doc_id}", (JSON.stringify(u) for u in updates)..., callback

	getDiff: (project_id, doc_id, from, to, callback = (error, diff) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/diff?from=#{from}&to=#{to}"
		}, (error, response, body) =>
			response.statusCode.should.equal 200
			callback null, JSON.parse(body)

	getUpdates: (project_id, doc_id, options, callback = (error, body) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/updates?to=#{options.to}&limit=#{options.limit}"
		}, (error, response, body) =>
			response.statusCode.should.equal 200
			callback null, JSON.parse(body)

	restoreDoc: (project_id, doc_id, version, user_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/version/#{version}/restore"
			headers:
				"X-User-Id": user_id
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback null