/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FileHandler;
const settings = require("settings-sharelatex");
const PersistorManager = require("./PersistorManager");
const LocalFileWriter = require("./LocalFileWriter");
const logger = require("logger-sharelatex");
const FileConverter = require("./FileConverter");
const KeyBuilder = require("./KeyBuilder");
const async = require("async");
const ImageOptimiser = require("./ImageOptimiser");
const Errors = require('./Errors');

module.exports = (FileHandler = {

	insertFile(bucket, key, stream, callback){
		const convertedKey = KeyBuilder.getConvertedFolderKey(key);
		return PersistorManager.deleteDirectory(bucket, convertedKey, function(error) {
			if (error != null) { return callback(error); }
			return PersistorManager.sendStream(bucket, key, stream, callback);
		});
	},

	deleteFile(bucket, key, callback){
		const convertedKey = KeyBuilder.getConvertedFolderKey(key);
		return async.parallel([
			done => PersistorManager.deleteFile(bucket, key, done),
			done => PersistorManager.deleteDirectory(bucket, convertedKey, done)
		], callback);
	},

	getFile(bucket, key, opts, callback){
		// In this call, opts can contain credentials
		if (opts == null) { opts = {}; }
		logger.log({bucket, key, opts:this._scrubSecrets(opts)}, "getting file");
		if ((opts.format == null) && (opts.style == null)) {
			return this._getStandardFile(bucket, key, opts, callback);
		} else {
			return this._getConvertedFile(bucket, key, opts, callback);
		}
	},

	getFileSize(bucket, key, callback) {
		return PersistorManager.getFileSize(bucket, key, callback);
	},

	_getStandardFile(bucket, key, opts, callback){
		return PersistorManager.getFileStream(bucket, key, opts, function(err, fileStream){
			if ((err != null) && !(err instanceof Errors.NotFoundError)) {
				logger.err({bucket, key, opts:FileHandler._scrubSecrets(opts)}, "error getting fileStream");
			}
			return callback(err, fileStream);
		});
	},

	_getConvertedFile(bucket, key, opts, callback){
		const convertedKey = KeyBuilder.addCachingToKey(key, opts);
		return PersistorManager.checkIfFileExists(bucket, convertedKey, (err, exists)=> {
			if (err != null) {
				return callback(err);
			}
			if (exists) {
				return PersistorManager.getFileStream(bucket, convertedKey, opts, callback);
			} else {
				return this._getConvertedFileAndCache(bucket, key, convertedKey, opts, callback);
			}
		});
	},

	_getConvertedFileAndCache(bucket, key, convertedKey, opts, callback){
		let convertedFsPath = "";
		const originalFsPath = "";
		return async.series([
			cb => {
				return this._convertFile(bucket, key, opts, function(err, fileSystemPath, originalFsPath) {
					convertedFsPath = fileSystemPath;
					originalFsPath = originalFsPath;
					return cb(err);
				});
			},
			cb => ImageOptimiser.compressPng(convertedFsPath, cb),
			cb => PersistorManager.sendFile(bucket, convertedKey, convertedFsPath, cb)
		], function(err){
			if (err != null) {
				LocalFileWriter.deleteFile(convertedFsPath, function() {});
				LocalFileWriter.deleteFile(originalFsPath, function() {});
				return callback(err);
			}
			// Send back the converted file from the local copy to avoid problems
			// with the file not being present in S3 yet.  As described in the
			// documentation below, we have already made a 'HEAD' request in
			// checkIfFileExists so we only have "eventual consistency" if we try
			// to stream it from S3 here.  This was a cause of many 403 errors.
			//
			// "Amazon S3 provides read-after-write consistency for PUTS of new
			// objects in your S3 bucket in all regions with one caveat. The
			// caveat is that if you make a HEAD or GET request to the key name
			// (to find if the object exists) before creating the object, Amazon
			// S3 provides eventual consistency for read-after-write.""
			// https://docs.aws.amazon.com/AmazonS3/latest/dev/Introduction.html#ConsistencyModel
			return LocalFileWriter.getStream(convertedFsPath, function(err, readStream) {
				if (err != null) { return callback(err); }
				readStream.on('end', function() {
					logger.log({convertedFsPath}, "deleting temporary file");
					return LocalFileWriter.deleteFile(convertedFsPath, function() {});
				});
				return callback(null, readStream);
			});
		});
	},

	_convertFile(bucket, originalKey, opts, callback){
		return this._writeS3FileToDisk(bucket, originalKey, opts, function(err, originalFsPath){
			if (err != null) {
				return callback(err);
			}
			const done = function(err, destPath){
				if (err != null) {
					logger.err({err, bucket, originalKey, opts:FileHandler._scrubSecrets(opts)}, "error converting file");
					return callback(err);
				}
				LocalFileWriter.deleteFile(originalFsPath, function() {});
				return callback(err, destPath, originalFsPath);
			};

			logger.log({opts}, "converting file depending on opts");
			
			if (opts.format != null) {
				return FileConverter.convert(originalFsPath, opts.format, done);
			} else if (opts.style === "thumbnail") {
				return FileConverter.thumbnail(originalFsPath, done);
			} else if (opts.style === "preview") {
				return FileConverter.preview(originalFsPath, done);
			} else {
				return callback(new Error(`should have specified opts to convert file with ${JSON.stringify(opts)}`));
			}
		});
	},


	_writeS3FileToDisk(bucket, key, opts, callback){
		return PersistorManager.getFileStream(bucket, key, opts, function(err, fileStream){
			if (err != null) {
				return callback(err);
			}
			return LocalFileWriter.writeStream(fileStream, key, callback);
		});
	},

	getDirectorySize(bucket, project_id, callback){
		logger.log({bucket, project_id}, "getting project size");
		return PersistorManager.directorySize(bucket, project_id, function(err, size){
			if (err != null) {
				logger.err({bucket, project_id}, "error getting size");
			}
			return callback(err, size);
		});
	},

	_scrubSecrets(opts){
		const safe = Object.assign({}, opts);
		delete safe.credentials;
		return safe;
	}
});
