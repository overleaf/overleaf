settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
FileHandler = require("./FileHandler")
metrics = require("metrics-sharelatex")
Errors = require('./Errors')

module.exports = BucketController =

	getFile: (req, res)->
		{bucket} = req
		key = req[0]
		{format, style} = req.query
		credentials = settings.filestore.s3&[bucket]
		options = {
			key: key,
			bucket: bucket,
			credentials: credentials
		}
		metrics.inc "#{bucket}.getFile"
		logger.log key:key, bucket:bucket, "receiving request to get file from bucket"
		FileHandler.getFile bucket, key, options, (err, fileStream)->
			if err?
				logger.err err:err, key:key, bucket:bucket, format:format, style:style, "problem getting file from bucket"
				if err instanceof Errors.NotFoundError
					return res.send 404
				else
					return res.send 500
			else
				logger.log key:key, bucket:bucket, format:format, style:style, "sending bucket file to response"
				fileStream.pipe res
