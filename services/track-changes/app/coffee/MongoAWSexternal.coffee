settings = require "settings-sharelatex"
child_process = require "child_process"
mongoUri = require "mongo-uri";
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
fs = require 'fs'
S3S = require 's3-streams'

module.exports = MongoAWSexternal =

	archiveDocHistory: (project_id, doc_id, callback = (error) ->) ->
		MongoAWS.mongoExportDocHistory doc_id, (error, filepath) ->
			MongoAWS.s3upStream project_id, doc_id, filepath, callback
				#delete temp file?


	unArchiveDocHistory: (project_id, doc_id, callback = (error) ->) ->
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
