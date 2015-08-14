settings = require "settings-sharelatex"
child_process = require "child_process"
mongoUri = require "mongo-uri";
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
fs = require 'fs'
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
				if ops.length > MongoAWS.bulkLimit
					MongoAWS.handleBulk ops, () ->
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

		bulk.execute (err, result) ->
			if err?
				logger.error err:err, "error bulking ReadlineStream"
			else
				logger.log result:result, "bulked ReadlineStream"
			cb(err)


	archiveDocHistoryExternal: (project_id, doc_id, callback = (error) ->) ->
		MongoAWS.mongoExportDocHistory doc_id, (error, filepath) ->
			MongoAWS.s3upStream project_id, doc_id, filepath, callback
				#delete temp file?


	unArchiveDocHistoryExternal: (project_id, doc_id, callback = (error) ->) ->
		MongoAWS.s3downStream project_id, doc_id, (error, filepath) ->
			if error == null
				MongoAWS.mongoImportDocHistory filepath, callback
					#delete temp file?
			else
				callback

	mongoExportDocHistory: (doc_id, callback = (error, filepath) ->) ->
		uriData = mongoUri.parse(settings.mongo.url);
		filepath = settings.path.dumpFolder + '/' + doc_id + '.jsonUp' 

		args = []
		args.push '-h' 
		args.push uriData.hosts[0]
		args.push '-d'
		args.push uriData.database
		args.push '-c' 
		args.push 'docHistory'
		args.push '-q'
		args.push "{doc_id: ObjectId('#{doc_id}') , expiresAt: {$exists : false} }"
		args.push '-o' 
		args.push filepath

		proc = child_process.spawn "mongoexport", args

		proc.on "error", callback

		stderr = ""
		proc.stderr.on "data", (chunk) -> stderr += chunk.toString()

		proc.on "close", (code) ->
			if code == 0
				return callback(null,filepath)
			else
				return callback(new Error("mongodump failed: #{stderr}"),null)

	mongoImportDocHistory: (filepath, callback = (error) ->) ->

		uriData = mongoUri.parse(settings.mongo.url);

		args = []
		args.push '-h' 
		args.push uriData.hosts[0]
		args.push '-d'
		args.push uriData.database
		args.push '-c' 
		args.push 'docHistory'
		args.push '--file' 
		args.push filepath

		proc = child_process.spawn "mongoimport", args

		proc.on "error", callback

		stderr = ""
		proc.stderr.on "data", (chunk) -> stderr += chunk.toString()

		proc.on "close", (code) ->
			if code == 0
				return callback(null,filepath)
			else
				return callback(new Error("mongodump failed: #{stderr}"),null)

	s3upStream: (project_id, doc_id, filepath, callback = (error) ->) ->

		AWS.config.update {
			accessKeyId: settings.filestore.s3.key
			secretAccessKey: settings.filestore.s3.secret
		}
		 
		upload = S3S.WriteStream new AWS.S3(), {
			"Bucket": settings.filestore.stores.user_files,
			"Key": project_id+"/changes-"+doc_id
		}

		fs.createReadStream(filepath)
			.on 'open', (obj) ->
				return 1
			.pipe(upload)
			.on 'finish', () ->
				return callback(null)
			.on 'error', (err) ->
				return callback(err)

	s3downStream: (project_id, doc_id, callback = (error, filepath) ->) ->

		filepath = settings.path.dumpFolder + '/' + doc_id + '.jsonDown' 

		AWS.config.update {
			accessKeyId: settings.filestore.s3.key
			secretAccessKey: settings.filestore.s3.secret
		}
		 
		download = S3S.ReadStream new AWS.S3(), {
			"Bucket": settings.filestore.stores.user_files,
			"Key": project_id+"/changes-"+doc_id
		}

		download
			.on 'open', (obj) ->
				return 1
			.pipe(fs.createWriteStream(filepath))
			.on 'finish', () ->
				return callback(null, filepath)
			.on 'error', (err) ->
				return callback(err, null)
