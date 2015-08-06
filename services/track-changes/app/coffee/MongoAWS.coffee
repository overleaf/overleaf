settings = require "settings-sharelatex"
child_process = require "child_process"
mongoUri = require "mongo-uri";
logger = require "logger-sharelatex"
AWS = require 'aws-sdk'
fs = require 'fs'


module.exports = MongoAWS =

	archiveDocHistory: (project_id, doc_id, callback = (error) ->) ->
		MongoAWS.mongoDumpDocHistory doc_id, (error,filepath) ->
			MongoAWS.s3upload project_id, doc_id, filepath, callback

	mongoDumpDocHistory: (doc_id, callback = (error, filepath) ->) ->
		uriData = mongoUri.parse(settings.mongo.url);
		filepath = settings.path.dumpFolder + '/' + doc_id + '.json' 

		args = []
		args.push '-h' 
		args.push uriData.hosts[0]
		args.push '-d'
		args.push uriData.database
		args.push '-c' 
		args.push 'docHistory'
		args.push '-q'
		args.push "{doc_id: ObjectId('#{doc_id}') }"
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

	s3upload: (project_id, doc_id, filepath, callback = (error) ->) ->

		AWS.config.update {
			accessKeyId: settings.filestore.s3.key
			secretAccessKey: settings.filestore.s3.secret
		}

		s3Stream = require('s3-upload-stream')(new AWS.S3());

		upload = s3Stream.upload {
		  "Bucket": settings.filestore.stores.user_files,
		  "Key": project_id+"/changes-"+doc_id
		}

		read = fs.createReadStream filepath

		#Handle errors.
		upload.on 'error', callback

		#Handle upload completion.
		upload.on 'uploaded', (details) ->
			return callback(null)

		#Pipe the incoming filestream and up to S3.
		read.pipe(upload);

