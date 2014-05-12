PersistorManager = require("./PersistorManager")
settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
FileHandler = require("./FileHandler")
metrics = require("metrics-sharelatex")
oneDayInSeconds = 60 * 60 * 24

module.exports =

	getFile: (req, res)->
		metrics.inc "getFile"
		{key, bucket} = req
		{format, style} = req.query
		logger.log key:key, bucket:bucket, format:format, style:style, "reciving request to get file"
		FileHandler.getFile bucket, key, {format:format,style:style}, (err, fileStream)->
			if err?
				logger.err err:err, key:key, bucket:bucket, format:format, style:style, "problem getting file"
				if !res.finished and res?.send? 
					res.send 500
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
			res.send 200

	copyFile: (req, res)->
		metrics.inc "copyFile"
		{key, bucket} = req
		oldProject_id = req.body.source.project_id
		oldFile_id = req.body.source.file_id
		logger.log key:key, bucket:bucket, oldProject_id:oldProject_id, oldFile_id:oldFile_id, "reciving request to copy file"
		PersistorManager.copyFile bucket, "#{oldProject_id}/#{oldFile_id}", key, (err)->
			if err? 
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



