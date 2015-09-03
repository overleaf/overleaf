settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
S3S = require 's3-streams'
{db, ObjectId} = require "./mongojs"
JSONStream = require "JSONStream"
ReadlineStream = require "readline-stream"

module.exports = MongoAWS =

	bulkLimit: 10

	archiveDocHistory: (project_id, doc_id, callback = (error) ->) ->
		query = {
			doc_id: ObjectId(doc_id)
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
			.pipe JSONStream.stringify()
				.pipe upload
				.on 'finish', () ->
					return callback(null)

	unArchiveDocHistory: (project_id, doc_id, callback = (error) ->) ->

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

		download
			.on 'open', (obj) ->
				return 1
			.pipe lineStream
			.on 'data', (line) ->
				if line.length > 2
					ops.push(JSON.parse(line))
				if ops.length == MongoAWS.bulkLimit
					MongoAWS.handleBulk ops.slice(0), () ->
					ops.splice(0,ops.length)
			.on 'end', () ->
				MongoAWS.handleBulk ops, callback
			.on 'error', (err) ->
				return callback(err)

	handleBulk: (ops, cb) ->
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
					logger.log count:ops.length, result:result, "bulked ReadlineStream"
				cb(err)
		else
			cb()
