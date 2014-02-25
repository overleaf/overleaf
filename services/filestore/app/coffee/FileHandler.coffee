settings = require("settings-sharelatex")
fsWrapper = require("./fsWrapper")
LocalFileWriter = require("./LocalFileWriter")
logger = require("logger-sharelatex")
FileConverter = require("./FileConverter")
KeyBuilder = require("./KeyBuilder")
async = require("async")
ImageOptimiser = require("./ImageOptimiser")


module.exports =

	insertFile: (bucket, key, stream, callback)->
		convetedKey = KeyBuilder.getConvertedFolderKey(key)
		fsWrapper.deleteDirectory bucket, convetedKey, ->
			fsWrapper.sendStreamToS3 bucket, key, stream, ->
				callback()

	deleteFile: (bucket, key, callback)->
		convetedKey = KeyBuilder.getConvertedFolderKey(bucket, key)
		async.parallel [
			(done)-> fsWrapper.deleteFile bucket, key, done
			(done)-> fsWrapper.deleteFile bucket, convetedKey, done
		], callback

	getFile: (bucket, key, opts = {}, callback)->
		logger.log bucket:bucket, key:key, opts:opts, "getting file"
		if !opts.format? and !opts.style?
			@_getStandardFile bucket, key, opts, callback
		else
			@_getConvertedFile bucket, key, opts, callback

	_getStandardFile: (bucket, key, opts, callback)->
		fsWrapper.getFileStream bucket, key, (err, fileStream)->
			if err?
				logger.err  bucket:bucket, key:key, opts:opts, "error getting fileStream"
			callback err, fileStream

	_getConvertedFile: (bucket, key, opts, callback)->
		convetedKey = KeyBuilder.addCachingToKey(key, opts)
		fsWrapper.checkIfFileExists bucket, convetedKey, (err, exists)=>
			if exists
				fsWrapper.getFileStream bucket, convetedKey, callback
			else
				@_getConvertedFileAndCache bucket, key, convetedKey, opts, callback

	_getConvertedFileAndCache: (bucket, key, convetedKey, opts, callback)->
		@_convertFile bucket, key, opts, (err, fsPath)->
			if err?
				logger.err err:err, fsPath:fsPath, bucket:bucket, key:key, opts:opts, "something went wrong with converting file"
				return callback(err)
			ImageOptimiser.compressPng fsPath, (err)->
				if err?
					logger.err err:err, fsPath:fsPath, bucket:bucket, key:key, opts:opts, "something went wrong optimising png file"
					return callback(err)
				fsWrapper.sendFileToS3 bucket, convetedKey, fsPath, (err)->
					if err?
						logger.err err:err, bucket:bucket, key:key, convetedKey:convetedKey, opts:opts, "something went wrong sending the file"
						return callback(err)
					fsWrapper.getFileStream bucket, convetedKey, callback

	_convertFile: (bucket, origonalKey, opts, callback)->
		@_writeS3FileToDisk bucket, origonalKey, (err, origonalFsPath)->
			if opts.format?
				FileConverter.convert origonalFsPath, opts.format, callback
			else if opts.style == "thumbnail"
				FileConverter.thumbnail origonalFsPath, callback
			else if opts.style == "preview"
				FileConverter.preview origonalFsPath, callback
			else 
				throw new Error("should have specified opts to convert file with #{JSON.stringify(opts)}")


	_writeS3FileToDisk: (bucket, key, callback)->
		fsWrapper.getFileStream bucket, key, (err, fileStream)->
			LocalFileWriter.writeStream fileStream, key, callback

