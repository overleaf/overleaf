/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This  module is not used in production, which currently uses
// S3PersistorManager.  The intention is to migrate S3PersistorManager to use the
// latest aws-sdk and delete this module so that PersistorManager would load the
// same backend for both the 's3' and 'aws-sdk' options.

const logger = require("logger-sharelatex");
const aws = require("aws-sdk");
const _ = require("underscore");
const fs = require("fs");
const Errors = require("./Errors");

const s3 = new aws.S3();

module.exports = {
	sendFile(bucketName, key, fsPath, callback){
		logger.log({bucketName, key}, "send file data to s3");
		const stream = fs.createReadStream(fsPath);
		return s3.upload({Bucket: bucketName, Key: key, Body: stream}, function(err, data) {
			if (err != null) {
				logger.err({err, Bucket: bucketName, Key: key}, "error sending file data to s3");
			}
			return callback(err);
		});
	},

	sendStream(bucketName, key, stream, callback){
		logger.log({bucketName, key}, "send file stream to s3");
		return s3.upload({Bucket: bucketName, Key: key, Body: stream}, function(err, data) {
			if (err != null) {
				logger.err({err, Bucket: bucketName, Key: key}, "error sending file stream to s3");
			}
			return callback(err);
		});
	},

	getFileStream(bucketName, key, opts, callback){
		if (callback == null) { callback = function(err, res){}; }
		logger.log({bucketName, key}, "get file stream from s3");
		callback = _.once(callback);
		const params = {
			Bucket:bucketName,
			Key: key
		};
		if ((opts.start != null) && (opts.end != null)) {
			params['Range'] = `bytes=${opts.start}-${opts.end}`;
		}
		const request = s3.getObject(params);
		const stream = request.createReadStream();
		stream.on('readable', () => callback(null, stream));
		return stream.on('error', function(err) {
			logger.err({err, bucketName, key}, "error getting file stream from s3");
			if (err.code === 'NoSuchKey') {
				return callback(new Errors.NotFoundError(`File not found in S3: ${bucketName}:${key}`));
			}
			return callback(err);
		});
	},

	copyFile(bucketName, sourceKey, destKey, callback){
		logger.log({bucketName, sourceKey, destKey}, "copying file in s3");
		const source = bucketName + '/' + sourceKey;
		return s3.copyObject({Bucket: bucketName, Key: destKey, CopySource: source}, function(err) {
			if (err != null) {
				logger.err({err, bucketName, sourceKey, destKey}, "something went wrong copying file in s3");
			}
			return callback(err);
		});
	},

	deleteFile(bucketName, key, callback){
		logger.log({bucketName, key}, "delete file in s3");
		return s3.deleteObject({Bucket: bucketName, Key: key}, function(err) {
			if (err != null) {
				logger.err({err, bucketName, key}, "something went wrong deleting file in s3");
			}
			return callback(err);
		});
	},

	deleteDirectory(bucketName, key, callback){
		logger.log({bucketName, key}, "delete directory in s3");
		return s3.listObjects({Bucket: bucketName, Prefix: key}, function(err, data) {
			if (err != null) {
				logger.err({err, bucketName, key}, "something went wrong listing prefix in s3");
				return callback(err);
			}
			if (data.Contents.length === 0) {
				logger.log({bucketName, key}, "the directory is empty");
				return callback();
			}
			const keys = _.map(data.Contents, entry => ({
                Key: entry.Key
            }));
			return s3.deleteObjects({
				Bucket: bucketName,
				Delete: {
					Objects: keys,
					Quiet: true
				}
			}
			, function(err) {
					if (err != null) {
						logger.err({err, bucketName, key:keys}, "something went wrong deleting directory in s3");
					}
					return callback(err);
			});
		});
	},

	checkIfFileExists(bucketName, key, callback){
		logger.log({bucketName, key}, "check file existence in s3");
		return s3.headObject({Bucket: bucketName, Key: key}, function(err, data) {
			if (err != null) {
				if (err.code === 'NotFound') { return (callback(null, false)); }
				logger.err({err, bucketName, key}, "something went wrong checking head in s3");
				return callback(err);
			}
			return callback(null, (data.ETag != null));
		});
	},

	directorySize(bucketName, key, callback){
		logger.log({bucketName, key}, "get project size in s3");
		return s3.listObjects({Bucket: bucketName, Prefix: key}, function(err, data) {
			if (err != null) {
				logger.err({err, bucketName, key}, "something went wrong listing prefix in s3");
				return callback(err);
			}
			if (data.Contents.length === 0) {
				logger.log({bucketName, key}, "the directory is empty");
				return callback();
			}
			let totalSize = 0;
			_.each(data.Contents, entry => totalSize += entry.Size);
			return callback(null, totalSize);
		});
	}
};

