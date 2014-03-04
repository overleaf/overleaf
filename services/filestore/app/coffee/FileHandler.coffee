settings = require("settings-sharelatex")
PersistorManager = require("./PersistorManager")
LocalFileWriter = require("./LocalFileWriter")
logger = require("logger-sharelatex")
FileConverter = require("./FileConverter")
KeyBuilder = require("./KeyBuilder")
async = require("async")
ImageOptimiser = require("./ImageOptimiser")

module.exports =

	insertFile: (bucket, key, stream, callback)->
		convetedKey = KeyBuilder.getConvertedFolderKey(key)
		PersistorManager.deleteDirectory bucket, convetedKey, ->
			PersistorManager.sendStream bucket, key, stream, ->
				callback()

	deleteFile: (bucket, key, callback)->
		convetedKey = KeyBuilder.getConvertedFolderKey(bucket, key)
		async.parallel [
			(done)-> PersistorManager.deleteFile bucket, key, done
			(done)-> PersistorManager.deleteFile bucket, convetedKey, done
		], callback

	getFile: (bucket, key, opts = {}, callback)->
		logger.log bucket:bucket, key:key, opts:opts, "getting file"
		if !opts.format? and !opts.style?
			@_getStandardFile bucket, key, opts, callback
		else
			@_getConvertedFile bucket, key, opts, callback

	_getStandardFile: (bucket, key, opts, callback)->
		PersistorManager.getFileStream bucket, key, (err, fileStream)->
			if err?
				logger.err  bucket:bucket, key:key, opts:opts, "error getting fileStream"
			callback err, fileStream

	_getConvertedFile: (bucket, key, opts, callback)->
		convetedKey = KeyBuilder.addCachingToKey(key, opts)
		PersistorManager.checkIfFileExists bucket, convetedKey, (err, exists)=>
			if exists
				PersistorManager.getFileStream bucket, convetedKey, callback
			else
				@_getConvertedFileAndCache bucket, key, convetedKey, opts, callback

	_getConvertedFileAndCache: (bucket, key, convetedKey, opts, callback)->
		self = @
		convertedFsPath = ""
		async.series [
			(cb)->
				self._convertFile bucket, key, opts, (err, fileSystemPath)->
					convertedFsPath = fileSystemPath
					cb err
			(cb)->
				ImageOptimiser.compressPng convertedFsPath, cb
			(cb)->
				PersistorManager.sendFile bucket, convetedKey, convertedFsPath, cb
		], (err)->
			if err?
				return callback(err)
			PersistorManager.getFileStream bucket, convetedKey, callback

	_convertFile: (bucket, origonalKey, opts, callback)->
		@_writeS3FileToDisk bucket, origonalKey, (err, origonalFsPath)->
			done = (err, destPath)->
				if err?
					logger.err err:err, bucket:bucket, origonalKey:origonalKey, opts:opts, "error converting file"
					return callback(err)
				LocalFileWriter.deleteFile origonalFsPath, ->
				callback(err, destPath)

			if opts.format?
				FileConverter.convert origonalFsPath, opts.format, done
			else if opts.style == "thumbnail"
				FileConverter.thumbnail origonalFsPath, done
			else if opts.style == "preview"
				FileConverter.preview origonalFsPath, done
			else
				throw new Error("should have specified opts to convert file with #{JSON.stringify(opts)}")


	_writeS3FileToDisk: (bucket, key, callback)->
		PersistorManager.getFileStream bucket, key, (err, fileStream)->
			LocalFileWriter.writeStream fileStream, key, callback

