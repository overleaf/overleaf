PersistorManager = require("./PersistorManager")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
FileHandler = require("./FileHandler")
metrics = require("metrics-sharelatex")
parseRange = require('range-parser')
Errors = require('./Errors')

oneDayInSeconds = 60 * 60 * 24
maxSizeInBytes = 1024 * 1024 * 1024 # 1GB

module.exports = FileController =

	getFile: (req, res)->
		{key, bucket} = req
		{format, style} = req.query
		options = {
			key: key,
			bucket: bucket,
			format: format,
			style: style,
		}
		metrics.inc "getFile"
		logger.log key:key, bucket:bucket, format:format, style: style, "reciving request to get file"
		if req.headers.range?
			range = FileController._get_range(req.headers.range)
			options.start = range.start
			options.end = range.end
			logger.log start: range.start, end: range.end, "getting range of bytes from file"
		FileHandler.getFile bucket, key, options, (err, fileStream)->
			if err?
				if err instanceof Errors.NotFoundError
					return res.send 404
				else
					logger.err err:err, key:key, bucket:bucket, format:format, style:style, "problem getting file"
					return res.send 500
			else if req.query.cacheWarm
				logger.log key:key, bucket:bucket, format:format, style:style, "request is only for cache warm so not sending stream"
				res.send 200
			else
				logger.log key:key, bucket:bucket, format:format, style:style, "sending file to response"
				fileStream.pipe res

	insertFile: (req, res)->
		metrics.inc "insertFile"
		{key, bucket} = req
		logger.log key:key, bucket:bucket, "reciving request to insert file"
		FileHandler.insertFile bucket, key, req, (err)->
			if err?
				logger.log err: err, key: key, bucket: bucket, "error inserting file"
				res.send 500
			else
				res.send 200

	copyFile: (req, res)->
		metrics.inc "copyFile"
		{key, bucket} = req
		oldProject_id = req.body.source.project_id
		oldFile_id = req.body.source.file_id
		logger.log key:key, bucket:bucket, oldProject_id:oldProject_id, oldFile_id:oldFile_id, "reciving request to copy file"
		PersistorManager.copyFile bucket, "#{oldProject_id}/#{oldFile_id}", key, (err)->
			if err?
				if err instanceof Errors.NotFoundError
					res.send 404
				else
					logger.log err:err, oldProject_id:oldProject_id, oldFile_id:oldFile_id, "something went wrong copying file"
					res.send 500
			else
				res.send 200

	deleteFile: (req, res)->
		metrics.inc "deleteFile"
		{key, bucket} = req
		logger.log key:key, bucket:bucket,  "reciving request to delete file"
		FileHandler.deleteFile bucket, key, (err)->
			if err?
				logger.log err:err, key:key, bucket:bucket, "something went wrong deleting file"
				res.send 500
			else
				res.send 204

	_get_range: (header) ->
		parsed = parseRange(maxSizeInBytes, header)
		if parsed == -1 or parsed == -2 or parsed.type != 'bytes'
			null
		else
			range = parsed[0]
			{start: range.start, end: range.end}

	directorySize: (req, res)->
		metrics.inc "projectSize"
		{project_id, bucket} = req
		logger.log project_id:project_id, bucket:bucket, "reciving request to project size"
		FileHandler.getDirectorySize bucket, project_id, (err, size)->
			if err?
				logger.log err: err, project_id: project_id, bucket: bucket, "error inserting file"
				res.send 500
			else
				res.json {'total bytes' : size}
