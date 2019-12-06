# This  module is not used in production, which currently uses
# S3PersistorManager.  The intention is to migrate S3PersistorManager to use the
# latest aws-sdk and delete this module so that PersistorManager would load the
# same backend for both the 's3' and 'aws-sdk' options.

logger = require "logger-sharelatex"
aws = require "aws-sdk"
_ = require "underscore"
fs = require "fs"
Errors = require "./Errors"

s3 = new aws.S3()

module.exports =
	sendFile: (bucketName, key, fsPath, callback)->
		logger.log bucketName:bucketName, key:key, "send file data to s3"
		stream = fs.createReadStream fsPath
		s3.upload Bucket: bucketName, Key: key, Body: stream, (err, data) ->
			if err?
				logger.err err: err, Bucket: bucketName, Key: key, "error sending file data to s3"
			callback err

	sendStream: (bucketName, key, stream, callback)->
		logger.log bucketName:bucketName, key:key, "send file stream to s3"
		s3.upload Bucket: bucketName, Key: key, Body: stream, (err, data) ->
			if err?
				logger.err err: err, Bucket: bucketName, Key: key, "error sending file stream to s3"
			callback err

	getFileStream: (bucketName, key, opts, callback = (err, res)->)->
		logger.log bucketName:bucketName, key:key, "get file stream from s3"
		callback = _.once callback
		params =
			Bucket:bucketName
			Key: key
		if opts.start? and opts.end?
			params['Range'] = "bytes=#{opts.start}-#{opts.end}"
		request = s3.getObject params
		stream = request.createReadStream()
		stream.on 'readable', () ->
			callback null, stream
		stream.on 'error', (err) ->
			logger.err err:err, bucketName:bucketName, key:key, "error getting file stream from s3"
			if err.code == 'NoSuchKey'
				return callback new Errors.NotFoundError "File not found in S3: #{bucketName}:#{key}"
			callback err

	copyFile: (bucketName, sourceKey, destKey, callback)->
		logger.log bucketName:bucketName, sourceKey:sourceKey, destKey: destKey, "copying file in s3"
		source = bucketName + '/' + sourceKey
		s3.copyObject {Bucket: bucketName, Key: destKey, CopySource: source}, (err) ->
			if err?
				logger.err err:err, bucketName:bucketName, sourceKey:sourceKey, destKey:destKey, "something went wrong copying file in s3"
			callback err

	deleteFile: (bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "delete file in s3"
		s3.deleteObject {Bucket: bucketName, Key: key}, (err) ->
			if err?
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong deleting file in s3"
			callback err

	deleteDirectory: (bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "delete directory in s3"
		s3.listObjects {Bucket: bucketName, Prefix: key}, (err, data) ->
			if err?
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong listing prefix in s3"
				return callback err
			if data.Contents.length == 0
				logger.log bucketName:bucketName, key:key, "the directory is empty"
				return callback()
			keys = _.map data.Contents, (entry)->
				Key: entry.Key
			s3.deleteObjects
				Bucket: bucketName
				Delete:
					Objects: keys
					Quiet: true
			, (err) ->
					if err?
						logger.err err:err, bucketName:bucketName, key:keys, "something went wrong deleting directory in s3"
					callback err

	checkIfFileExists:(bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "check file existence in s3"
		s3.headObject {Bucket: bucketName, Key: key}, (err, data) ->
			if err?
				return (callback null, false) if err.code == 'NotFound'
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong checking head in s3"
				return callback err
			callback null, data.ETag?

	directorySize:(bucketName, key, callback)->
		logger.log bucketName:bucketName, key:key, "get project size in s3"
		s3.listObjects {Bucket: bucketName, Prefix: key}, (err, data) ->
			if err?
				logger.err err:err, bucketName:bucketName, key:key, "something went wrong listing prefix in s3"
				return callback err
			if data.Contents.length == 0
				logger.log bucketName:bucketName, key:key, "the directory is empty"
				return callback()
			totalSize = 0
			_.each data.Contents, (entry)->
				totalSize += entry.Size
			callback null, totalSize

