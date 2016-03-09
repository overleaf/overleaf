settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
S3S = require 's3-streams'
{db, ObjectId} = require "./mongojs"
JSONStream = require "JSONStream"
ReadlineStream = require "byline"
zlib = require "zlib"

DAYS = 24 * 3600 * 1000 # one day in milliseconds

createStream = (streamConstructor, project_id, doc_id, pack_id) ->
	AWS_CONFIG =
		accessKeyId: settings.trackchanges.s3.key
		secretAccessKey: settings.trackchanges.s3.secret

	return streamConstructor new AWS.S3(AWS_CONFIG), {
		"Bucket": settings.trackchanges.stores.doc_history,
		"Key": project_id+"/changes-"+doc_id+"/pack-"+pack_id
	}

module.exports = MongoAWS =

	archivePack: (project_id, doc_id, pack_id, _callback = (error) ->) ->

		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		query = {
			_id: ObjectId(pack_id)
			doc_id: ObjectId(doc_id)
		}

		return callback new Error("invalid project id") if not project_id?
		return callback new Error("invalid doc id") if not doc_id?
		return callback new Error("invalid pack id") if not pack_id?

		logger.log {project_id, doc_id, pack_id}, "uploading data to s3"

		upload = createStream S3S.WriteStream, project_id, doc_id, pack_id

		db.docHistory.findOne query, (err, result) ->
			return callback(err) if err?
			return callback new Error("cannot find pack to send to s3") if not result?
			return callback new Error("refusing to send pack with TTL to s3") if result.expiresAt?
			uncompressedData = JSON.stringify(result)
			zlib.gzip uncompressedData, (err, buf) ->
				logger.log {project_id, doc_id, pack_id, origSize: uncompressedData.length, newSize: buf.length}, "compressed pack"
				return callback(err) if err?
				upload.on 'error', (err) ->
					callback(err)
				upload.on 'finish', () ->
					logger.log {project_id, doc_id, pack_id}, "upload to s3 completed"
					callback(null)
				upload.write buf
				upload.end()

	readArchivedPack: (project_id, doc_id, pack_id, _callback = (error, result) ->) ->
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		return callback new Error("invalid project id") if not project_id?
		return callback new Error("invalid doc id") if not doc_id?
		return callback new Error("invalid pack id") if not pack_id?

		logger.log {project_id, doc_id, pack_id}, "downloading data from s3"

		download = createStream S3S.ReadStream, project_id, doc_id, pack_id

		inputStream = download
			.on 'open', (obj) ->
				return 1
			.on 'error', (err) ->
				callback(err)

		gunzip = zlib.createGunzip()
		gunzip.setEncoding('utf8')
		gunzip.on 'error', (err) ->
			logger.log {project_id, doc_id, pack_id, err}, "error uncompressing gzip stream"
			callback(err)

		outputStream = inputStream.pipe gunzip
		parts = []
		outputStream.on 'error', (err) ->
			return callback(err)
		outputStream.on 'end', () ->
			logger.log {project_id, doc_id, pack_id}, "download from s3 completed"
			try
				object = JSON.parse parts.join('')
			catch e
				return callback(e)
			object._id = ObjectId(object._id)
			object.doc_id = ObjectId(object.doc_id)
			object.project_id = ObjectId(object.project_id)
			for op in object.pack
				op._id = ObjectId(op._id) if op._id?
			callback null, object
		outputStream.on 'data', (data) ->
			parts.push data

	unArchivePack: (project_id, doc_id, pack_id, callback = (error) ->) ->
		MongoAWS.readArchivedPack project_id, doc_id, pack_id, (err, object) ->
			return callback(err) if err?
			# allow the object to expire, we can always retrieve it again
			object.expiresAt = new Date(Date.now() + 7 * DAYS)
			logger.log {project_id, doc_id, pack_id}, "inserting object from s3"
			db.docHistory.insert object, callback
