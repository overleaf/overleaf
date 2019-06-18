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
Errors = require("./Errors")
_ = require("underscore")
awsS3 = require "aws-sdk/clients/s3"

thirtySeconds = 30 * 1000

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

defaultS3Client = new awsS3({
	credentials:
		accessKeyId: settings.filestore.s3.key,
		secretAccessKey: settings.filestore.s3.secret
})

getS3Client = (credentials) ->
	if credentials?
		return new awsS3({
			credentials:
				accessKeyId: credentials.auth_key
				secretAccessKey: credentials.auth_secret
		})
	else
		return defaultS3Client

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
			@sendFile bucketName, key, fsPath, (err) ->
				# delete the temporary file created above and return the original error
				LocalFileWriter.deleteFile fsPath, () ->
					callback(err)

	# opts may be {start: Number, end: Number}
	getFileStream: (bucketName, key, opts, callback = (err, res)->)->
		opts = opts || {}
		callback = _.once(callback)
		logger.log bucketName:bucketName, key:key, "getting file from s3"

		s3 = getS3Client(opts.credentials)
		s3Params = {
			Bucket: bucketName
			Key: key
		}
		if opts.start? and opts.end?
			s3Params['Range'] = "bytes=#{opts.start}-#{opts.end}"
		request = s3.getObject(s3Params)

		request.on 'httpHeaders', (statusCode, headers, response, statusMessage) =>
			if statusCode in [403, 404]
				# S3 returns a 403 instead of a 404 when the user doesn't have
				# permission to list the bucket contents.
				logger.log({ bucketName: bucketName, key: key }, "file not found in s3")
				return callback(new Errors.NotFoundError("File not found in S3: #{bucketName}:#{key}"), null)
			if statusCode not in [200, 206]
				logger.log({bucketName: bucketName, key: key }, "error getting file from s3: #{statusCode}")
				return callback(new Error("Got non-200 response from S3: #{statusCode} #{statusMessage}"), null)
			stream = response.httpResponse.getUnbufferedStream()
			callback(null, stream)

		request.on 'error', (err) =>
			logger.err({ err: err, bucketName: bucketName, key: key }, "error getting file stream from s3")
			callback(err)

		request.send()

	getFileSize: (bucketName, key, callback) ->
		logger.log({ bucketName: bucketName, key: key }, "getting file size from S3")
		s3 = getS3Client()
		s3.headObject { Bucket: bucketName, Key: key }, (err, data) ->
			if err?
				if err.statusCode in [403, 404]
					# S3 returns a 403 instead of a 404 when the user doesn't have
					# permission to list the bucket contents.
					logger.log({
						bucketName: bucketName,
						key: key
					}, "file not found in s3")
					callback(
						new Errors.NotFoundError("File not found in S3: #{bucketName}:#{key}")
					)
				else
					logger.err({
						bucketName: bucketName,
						key: key,
						err: err
					}, "error performing S3 HeadObject")
					callback(err)
				return
			callback(null, data.ContentLength)

	copyFile: (bucketName, sourceKey, destKey, callback)->
		logger.log bucketName:bucketName, sourceKey:sourceKey, destKey: destKey, "copying file in s3"
		source = bucketName + '/' + sourceKey
		# use the AWS SDK instead of knox due to problems with error handling (https://github.com/Automattic/knox/issues/114)
		s3 = getS3Client()
		s3.copyObject {Bucket: bucketName, Key: destKey, CopySource: source}, (err) ->
			if err?
				if err.code is 'NoSuchKey'
					logger.err bucketName:bucketName, sourceKey:sourceKey, "original file not found in s3 when copying"
					callback(new Errors.NotFoundError("original file not found in S3 when copying"))
				else
					logger.err err:err, bucketName:bucketName, sourceKey:sourceKey, destKey:destKey, "something went wrong copying file in aws"
					callback(err)
			else
				callback()

	deleteFile: (bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "delete file in s3"
		options = buildDefaultOptions(bucketName, "delete", key)
		request options, (err, res)->
			if err?
				logger.err err:err, res:res, bucketName:bucketName, key:key, "something went wrong deleting file in aws"
			callback(err)

	deleteDirectory: (bucketName, key, _callback)->
		# deleteMultiple can call the callback multiple times so protect against this.
		callback = (args...) ->
			_callback(args...)
			_callback = () ->

		logger.log key: key, bucketName: bucketName, "deleting directory"
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		s3Client.list prefix:key, (err, data)->
			if err?
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong listing prefix in aws"
				return callback(err)
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

	directorySize:(bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "get project size in s3"
		s3Client = knox.createClient
			key: settings.filestore.s3.key
			secret: settings.filestore.s3.secret
			bucket: bucketName
		s3Client.list prefix:key, (err, data)->
			if err?
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong listing prefix in aws"
				return callback(err)
			totalSize = 0
			_.each data.Contents, (entry)->
				totalSize += entry.Size
			logger.log totalSize:totalSize, "total size"
			callback null, totalSize
