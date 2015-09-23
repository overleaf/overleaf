settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
S3S = require 's3-streams'
{db, ObjectId} = require "./mongojs"
JSONStream = require "JSONStream"
ReadlineStream = require "readline-stream"

module.exports = MongoAWS =

	MAX_SIZE:  1024*1024 # almost max size
	MAX_COUNT: 1024 # almost max count

	archiveDocHistory: (project_id, doc_id, update, _callback = (error) ->) ->

		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		query = {
			doc_id: ObjectId(doc_id)
			v: {$lt: update.v}
			expiresAt: {$exists : false}
		}

		AWS.config.update {
			accessKeyId: settings.filestore.s3.key
			secretAccessKey: settings.filestore.s3.secret
		}
		 
		upload = S3S.WriteStream new AWS.S3(), {
			"Bucket": settings.filestore.stores.user_files,
			"Key": project_id+"/changes-"+doc_id
		}

		db.docHistory.find(query)
			.on 'error', (err) ->
				callback(err)
			.pipe JSONStream.stringify()
			.pipe upload
			.on 'error', (err) ->
				callback(err)
			.on 'finish', () ->
				return callback(null)

	unArchiveDocHistory: (project_id, doc_id, _callback = (error) ->) ->

		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		AWS.config.update {
			accessKeyId: settings.filestore.s3.key
			secretAccessKey: settings.filestore.s3.secret
		}
		 
		download = S3S.ReadStream new AWS.S3(), {
			"Bucket": settings.filestore.stores.user_files,
			"Key": project_id+"/changes-"+doc_id
		}, {
			encoding: "utf8"
		}

		lineStream = new ReadlineStream();
		ops = [] 
		sz = 0

		inputStream = download
			.on 'open', (obj) ->
				return 1
			.on 'error', (err) ->
				callback(err)
			.pipe lineStream

		inputStream.on 'data', (line) ->
				if line.length > 2
					ops.push(JSON.parse(line))
					sz += line.length 
				if ops.length >= MongoAWS.MAX_COUNT || sz >= MongoAWS.MAX_SIZE
					inputStream.pause()
					MongoAWS.handleBulk ops.slice(0), sz, () ->
						inputStream.resume()
					ops.splice(0,ops.length)
					sz = 0
			.on 'end', () ->
				MongoAWS.handleBulk ops, sz, callback
			.on 'error', (err) ->
				return callback(err)

	handleBulk: (ops, size, cb) ->
		bulk = db.docHistory.initializeUnorderedBulkOp();

		for op in ops
			op._id = ObjectId(op._id)
			op.doc_id = ObjectId(op.doc_id)
			op.project_id = ObjectId(op.project_id)
			bulk.find({_id:op._id}).upsert().updateOne(op)
			
		if ops.length > 0
			bulk.execute (err, result) ->
				if err?
					logger.error err:err, "error bulking ReadlineStream"
				else
					logger.log count:ops.length, result:result, size: size, "bulked ReadlineStream"
				cb(err)
		else
			cb()
