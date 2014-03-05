http = require('http')
http.globalAgent.maxSockets = 300
https = require('https')
https.globalAgent.maxSockets = 300
settings = require("settings-sharelatex")
request = require("request")
logger = require("logger-sharelatex")
fs = require("fs")
knox = require("knox")
path = require("path")
LocalFileWriter = require("./LocalFileWriter")
_ = require("underscore")

thirtySeconds = 30 * 1000


printSockets = ->
	console.log require('https').globalAgent.sockets
	console.log require('http').globalAgent.sockets
	setTimeout printSockets, thirtySeconds

printSockets()

buildDefaultOptions = (bucketName, method, key)->
	return {
			aws:
				key: settings.filestore.s3.key
				secret: settings.filestore.s3.secret
				bucket: bucketName
			method: method
			timeout: thirtySeconds
			uri:"https://#{bucketName}.s3.amazonaws.com/#{key}"
	}

module.exports =

	sendFile: (bucketName, key, fsPath, callback)->
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		putEventEmiter = s3Client.putFile fsPath, key, (err, res)->
			if err?
				logger.err err:err,  bucketName:bucketName, key:key, fsPath:fsPath,"something went wrong uploading file to s3"
				return callback(err)
			if !res?
				logger.err err:err, res:res, bucketName:bucketName, key:key, fsPath:fsPath, "no response from s3 put file"
				return callback("no response from put file")
			if res.statusCode != 200
				logger.err bucketName:bucketName, key:key, fsPath:fsPath, "non 200 response from s3 putting file"
				return callback("non 200 response from s3 on put file")
			LocalFileWriter.deleteFile fsPath, (err)->
				logger.log res:res,  bucketName:bucketName, key:key, fsPath:fsPath,"file uploaded to s3"
				callback(err)
		putEventEmiter.on "error", (err)->
			logger.err err:err,  bucketName:bucketName, key:key, fsPath:fsPath, "error emmited on put of file"
			callback err


	sendStream: (bucketName, key, readStream, callback)->
		logger.log bucketName:bucketName, key:key, "sending file to s3"
		readStream.on "error", (err)->
			logger.err bucketName:bucketName, key:key, "error on stream to send to s3"
		LocalFileWriter.writeStream readStream, null, (err, fsPath)=>
			if err?
				logger.err  bucketName:bucketName, key:key, fsPath:fsPath, err:err, "something went wrong writing stream to disk"
				return callback(err)
			@sendFile bucketName, key, fsPath, callback
			
	getFileStream: (bucketName, key, callback = (err, res)->)->
		logger.log bucketName:bucketName, key:key, "getting file from s3"
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		s3Stream = s3Client.get(key)
		s3Stream.end()
		s3Stream.on 'response', (res) ->
			callback null, res
		s3Stream.on 'error', (err) ->
			logger.err err:err, bucketName:bucketName, key:key, "error getting file stream from s3"
			callback err

	copyFile: (bucketName, sourceKey, destKey, callback)->
		logger.log bucketName:bucketName, sourceKey:sourceKey, destKey:destKey, "copying file in s3"
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		s3Client.copyFile sourceKey, destKey, (err)->
			if err?
				logger.err err:err, bucketName:bucketName, sourceKey:sourceKey, destKey:destKey, "something went wrong copying file in aws"
			callback(err)

	deleteFile: (bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "delete file in s3"
		options = buildDefaultOptions(bucketName, "delete", key)
		request options, (err, res)->
			if err?
				logger.err err:err, res:res, bucketName:bucketName, key:key, "something went wrong deleting file in aws"
			callback(err)

	deleteDirectory: (bucketName, key, callback)->
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		s3Client.list prefix:key, (err, data)->
			keys = _.map data.Contents, (entry)->
				return entry.Key
			s3Client.deleteMultiple keys, callback

	checkIfFileExists:(bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "checking if file exists in s3"
		options = buildDefaultOptions(bucketName, "head", key)
		request options, (err, res)->
			if err?
				logger.err err:err, res:res, bucketName:bucketName, key:key, "something went wrong checking file in aws"
				return callback(err)
			if !res?
				logger.err err:err, res:res, bucketName:bucketName, key:key, "no response object returned when checking if file exists"
				err = new Error("no response from s3 #{bucketName} #{key}")
				return callback(err)
			exists = res.statusCode == 200
			logger.log bucketName:bucketName, key:key, exists:exists, "checked if file exsists in s3"
			callback(err, exists)

