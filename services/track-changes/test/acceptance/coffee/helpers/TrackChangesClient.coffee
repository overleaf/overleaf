request = require "request"
rclient = require("redis").createClient() # Only works locally for now
{db, ObjectId} = require "../../../../app/js/mongojs"

module.exports = TrackChangesClient =
	flushAndGetCompressedUpdates: (project_id, doc_id, callback = (error, updates) ->) ->
		TrackChangesClient.flushDoc project_id, doc_id, (error) ->
			return callback(error) if error?
			TrackChangesClient.getCompressedUpdates doc_id, callback

	flushDoc: (project_id, doc_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/flush"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)

	flushProject: (project_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3015/project/#{project_id}/flush"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)

	getCompressedUpdates: (doc_id, callback = (error, updates) ->) ->
		db.docHistory
			.find(doc_id: ObjectId(doc_id))
			.sort("meta.end_ts": 1)
			.toArray callback

	getProjectMetaData: (project_id, callback = (error, updates) ->) ->
		db.projectHistoryMetaData
			.find {
				project_id: ObjectId(project_id)
			},
			(error, projects) ->
				callback error, projects[0]

	setPreserveHistoryForProject: (project_id, callback = (error) ->) ->
		db.projectHistoryMetaData.update {
			project_id: ObjectId(project_id)
			}, {
				$set: { preserveHistory: true }
			}, {
				upsert: true
			}, callback

	pushRawUpdates: (project_id, doc_id, updates, callback = (error) ->) ->
		rclient.sadd "DocsWithHistoryOps:#{project_id}", doc_id, (error) ->
			return callback(error) if error?
			rclient.rpush "UncompressedHistoryOps:#{doc_id}", (JSON.stringify(u) for u in updates)..., callback

	getDiff: (project_id, doc_id, from, to, callback = (error, diff) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/diff?from=#{from}&to=#{to}"
		}, (error, response, body) =>
			response.statusCode.should.equal 200
			callback null, JSON.parse(body)

	getUpdates: (project_id, options, callback = (error, body) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/updates?before=#{options.before}&min_count=#{options.min_count}"
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

	archiveProject: (project_id, callback = (error) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/archive"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)

	unarchiveProject: (project_id, callback = (error) ->) ->
		request.get {
			url: "http://localhost:3015/project/#{project_id}/unarchive"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)