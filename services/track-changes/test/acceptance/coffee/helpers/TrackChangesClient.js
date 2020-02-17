async = require 'async'
zlib = require 'zlib'
request = require "request"
Settings = require "settings-sharelatex"
rclient = require("redis-sharelatex").createClient(Settings.redis.history) # Only works locally for now
Keys = Settings.redis.history.key_schema
{db, ObjectId} = require "../../../../app/js/mongojs"

aws = require "aws-sdk"
s3 = new aws.S3(
	accessKeyId: Settings.trackchanges.s3.key
	secretAccessKey: Settings.trackchanges.s3.secret
	endpoint: Settings.trackchanges.s3.endpoint
	s3ForcePathStyle: Settings.trackchanges.s3.pathStyle
)
S3_BUCKET = Settings.trackchanges.stores.doc_history

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
		rclient.sadd Keys.docsWithHistoryOps({project_id}), doc_id, (error) ->
			return callback(error) if error?
			rclient.rpush Keys.uncompressedHistoryOps({doc_id}), (JSON.stringify(u) for u in updates)..., callback

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

	waitForS3: (done, retries=42) ->
		if !Settings.trackchanges.s3.endpoint
			return done()

		request.get "#{Settings.trackchanges.s3.endpoint}/", (err, res) ->
			if res && res.statusCode < 500
				return done()

			if retries == 0
				return done(err or new Error("s3 returned #{res.statusCode}"))

			setTimeout () ->
				TrackChangesClient.waitForS3(done, --retries)
			, 1000

	getS3Doc: (project_id, doc_id, pack_id, callback = (error, body) ->) ->
		params =
			Bucket: S3_BUCKET
			Key: "#{project_id}/changes-#{doc_id}/pack-#{pack_id}"

		s3.getObject params, (error, data) ->
			return callback(error) if error?
			body = data.Body
			return callback(new Error("empty response from s3")) if not body?
			zlib.gunzip body, (err, result) ->
				return callback(err) if err?
				callback(null, JSON.parse(result.toString()))

	removeS3Doc: (project_id, doc_id, callback = (error, res, body) ->) ->
		params =
			Bucket: S3_BUCKET
			Prefix: "#{project_id}/changes-#{doc_id}"

		s3.listObjects params, (error, data) ->
			return callback(error) if error?

			params =
				Bucket: S3_BUCKET
				Delete:
					Objects: data.Contents.map((s3object) -> {Key: s3object.Key})

			s3.deleteObjects params, callback
