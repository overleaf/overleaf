async = require 'async'
zlib = require 'zlib'
request = require "request"
rclient = require("redis").createClient() # Only works locally for now
{db, ObjectId} = require "../../../../app/js/mongojs"
Settings = require "settings-sharelatex"

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

	pushDocHistory: (project_id, doc_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/push"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)

	pullDocHistory: (project_id, doc_id, callback = (error) ->) ->
		request.post {
			url: "http://localhost:3015/project/#{project_id}/doc/#{doc_id}/pull"
		}, (error, response, body) =>
			response.statusCode.should.equal 204
			callback(error)

	buildS3Options: (content, key)->
		return {
				aws:
					key: Settings.trackchanges.s3.key
					secret: Settings.trackchanges.s3.secret
					bucket: Settings.trackchanges.stores.doc_history
				timeout: 30 * 1000
				json: content
				uri:"https://#{Settings.trackchanges.stores.doc_history}.s3.amazonaws.com/#{key}"
		}

	getS3Doc: (project_id, doc_id, pack_id, callback = (error, body) ->) ->
		options = TrackChangesClient.buildS3Options(true, project_id+"/changes-"+doc_id+"/pack-"+pack_id)
		options.encoding = null
		request.get options, (err, res, body) ->
			return callback(error) if error?
			zlib.gunzip body, (err, result) ->
				return callback(err) if err?
				callback(null, JSON.parse(result.toString()))

	removeS3Doc: (project_id, doc_id, callback = (error, res, body) ->) ->
		options = TrackChangesClient.buildS3Options(true, "?prefix=" + project_id + "/changes-" +doc_id)
		request.get options, (error, res, body) ->
			keys = body.match /[0-9a-f]{24}\/changes-[0-9a-f]{24}\/pack-[0-9a-f]{24}/g
			async.eachSeries keys, (key, cb) ->
				options = TrackChangesClient.buildS3Options(true, key)
				request.del options, cb
			, callback
