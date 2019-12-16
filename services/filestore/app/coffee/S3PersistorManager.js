/* eslint-disable
    handle-callback-err,
    new-cap,
    no-return-assign,
    no-unused-vars,
    node/no-deprecated-api,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
// This module is the one which is used in production.  It needs to be migrated
// to use aws-sdk throughout, see the comments in AWSSDKPersistorManager for
// details. The knox library is unmaintained and has bugs.

const http = require('http');
http.globalAgent.maxSockets = 300;
const https = require('https');
https.globalAgent.maxSockets = 300;
const settings = require("settings-sharelatex");
const request = require("request");
const logger = require("logger-sharelatex");
const metrics = require("metrics-sharelatex");
const fs = require("fs");
const knox = require("knox");
const path = require("path");
const LocalFileWriter = require("./LocalFileWriter");
const Errors = require("./Errors");
const _ = require("underscore");
const awsS3 = require("aws-sdk/clients/s3");
const URL = require('url');

const thirtySeconds = 30 * 1000;

const buildDefaultOptions = function(bucketName, method, key){
	let endpoint;
	if (settings.filestore.s3.endpoint) {
		endpoint = `${settings.filestore.s3.endpoint}/${bucketName}`;
	} else {
		endpoint = `https://${bucketName}.s3.amazonaws.com`;
	}
	return {
			aws: {
				key: settings.filestore.s3.key,
				secret: settings.filestore.s3.secret,
				bucket: bucketName
			},
			method,
			timeout: thirtySeconds,
			uri:`${endpoint}/${key}`
	};
};

const getS3Options = function(credentials) {
	const options = {
		credentials: {
			accessKeyId: credentials.auth_key,
			secretAccessKey: credentials.auth_secret
		}
	};

	if (settings.filestore.s3.endpoint) {
		const endpoint = URL.parse(settings.filestore.s3.endpoint);
		options.endpoint = settings.filestore.s3.endpoint;
		options.sslEnabled = endpoint.protocol === 'https';
	}

	return options;
};

const defaultS3Client = new awsS3(getS3Options({
	auth_key: settings.filestore.s3.key,
	auth_secret: settings.filestore.s3.secret
}));

const getS3Client = function(credentials) {
	if (credentials != null) {
		return new awsS3(getS3Options(credentials));
	} else {
		return defaultS3Client;
	}
};

const getKnoxClient = bucketName => {
	const options = {
		key: settings.filestore.s3.key,
		secret: settings.filestore.s3.secret,
		bucket: bucketName
	};
	if (settings.filestore.s3.endpoint) {
		const endpoint = URL.parse(settings.filestore.s3.endpoint);
		options.endpoint = endpoint.hostname;
		options.port = endpoint.port;
	}
	return knox.createClient(options);
};

module.exports = {

	sendFile(bucketName, key, fsPath, callback){
		const s3Client = getKnoxClient(bucketName);
		let uploaded = 0;
		const putEventEmiter = s3Client.putFile(fsPath, key, function(err, res){
			metrics.count('s3.egress', uploaded);
			if (err != null) {
				logger.err({err,  bucketName, key, fsPath},"something went wrong uploading file to s3");
				return callback(err);
			}
			if ((res == null)) {
				logger.err({err, res, bucketName, key, fsPath}, "no response from s3 put file");
				return callback("no response from put file");
			}
			if (res.statusCode !== 200) {
				logger.err({bucketName, key, fsPath}, "non 200 response from s3 putting file");
				return callback("non 200 response from s3 on put file");
			}
			logger.log({res,  bucketName, key, fsPath},"file uploaded to s3");
			return callback(err);
		});
		putEventEmiter.on("error", function(err){
			logger.err({err,  bucketName, key, fsPath}, "error emmited on put of file");
			return callback(err);
		});
		return putEventEmiter.on("progress", progress => uploaded = progress.written);
	},

	sendStream(bucketName, key, readStream, callback){
		logger.log({bucketName, key}, "sending file to s3");
		readStream.on("error", err => logger.err({bucketName, key}, "error on stream to send to s3"));
		return LocalFileWriter.writeStream(readStream, null, (err, fsPath)=> {
			if (err != null) {
				logger.err({bucketName, key, fsPath, err}, "something went wrong writing stream to disk");
				return callback(err);
			}
			return this.sendFile(bucketName, key, fsPath, err => // delete the temporary file created above and return the original error
            LocalFileWriter.deleteFile(fsPath, () => callback(err)));
		});
	},

	// opts may be {start: Number, end: Number}
	getFileStream(bucketName, key, opts, callback){
		if (callback == null) { callback = function(err, res){}; }
		opts = opts || {};
		callback = _.once(callback);
		logger.log({bucketName, key}, "getting file from s3");

		const s3 = getS3Client(opts.credentials);
		const s3Params = {
			Bucket: bucketName,
			Key: key
		};
		if ((opts.start != null) && (opts.end != null)) {
			s3Params.Range = `bytes=${opts.start}-${opts.end}`;
		}
		const s3Request = s3.getObject(s3Params);

		s3Request.on('httpHeaders', (statusCode, headers, response, statusMessage) => {
			if ([403, 404].includes(statusCode)) {
				// S3 returns a 403 instead of a 404 when the user doesn't have
				// permission to list the bucket contents.
				logger.log({ bucketName, key }, "file not found in s3");
				return callback(new Errors.NotFoundError(`File not found in S3: ${bucketName}:${key}`), null);
			}
			if (![200, 206].includes(statusCode)) {
				logger.log({bucketName, key }, `error getting file from s3: ${statusCode}`);
				return callback(new Error(`Got non-200 response from S3: ${statusCode} ${statusMessage}`), null);
			}
			const stream = response.httpResponse.createUnbufferedStream();
			stream.on('data', data => metrics.count('s3.ingress', data.byteLength));

			return callback(null, stream);
		});

		s3Request.on('error', err => {
			logger.err({ err, bucketName, key }, "error getting file stream from s3");
			return callback(err);
		});

		return s3Request.send();
	},

	getFileSize(bucketName, key, callback) {
		logger.log({ bucketName, key }, "getting file size from S3");
		const s3 = getS3Client();
		return s3.headObject({ Bucket: bucketName, Key: key }, function(err, data) {
			if (err != null) {
				if ([403, 404].includes(err.statusCode)) {
					// S3 returns a 403 instead of a 404 when the user doesn't have
					// permission to list the bucket contents.
					logger.log({
						bucketName,
						key
					}, "file not found in s3");
					callback(
						new Errors.NotFoundError(`File not found in S3: ${bucketName}:${key}`)
					);
				} else {
					logger.err({
						bucketName,
						key,
						err
					}, "error performing S3 HeadObject");
					callback(err);
				}
				return;
			}
			return callback(null, data.ContentLength);
		});
	},

	copyFile(bucketName, sourceKey, destKey, callback){
		logger.log({bucketName, sourceKey, destKey}, "copying file in s3");
		const source = bucketName + '/' + sourceKey;
		// use the AWS SDK instead of knox due to problems with error handling (https://github.com/Automattic/knox/issues/114)
		const s3 = getS3Client();
		return s3.copyObject({Bucket: bucketName, Key: destKey, CopySource: source}, function(err) {
			if (err != null) {
				if (err.code === 'NoSuchKey') {
					logger.err({bucketName, sourceKey}, "original file not found in s3 when copying");
					return callback(new Errors.NotFoundError("original file not found in S3 when copying"));
				} else {
					logger.err({err, bucketName, sourceKey, destKey}, "something went wrong copying file in aws");
					return callback(err);
				}
			} else {
				return callback();
			}
		});
	},

	deleteFile(bucketName, key, callback){
		logger.log({bucketName, key}, "delete file in s3");
		const options = buildDefaultOptions(bucketName, "delete", key);
		return request(options, function(err, res){
			if (err != null) {
				logger.err({err, res, bucketName, key}, "something went wrong deleting file in aws");
			}
			return callback(err);
		});
	},

	deleteDirectory(bucketName, key, _callback){
		// deleteMultiple can call the callback multiple times so protect against this.
		const callback = function(...args) {
			_callback(...Array.from(args || []));
			return _callback = function() {};
		};

		logger.log({key, bucketName}, "deleting directory");
		const s3Client = getKnoxClient(bucketName);
		return s3Client.list({prefix:key}, function(err, data){
			if (err != null) {
				logger.err({err, bucketName, key}, "something went wrong listing prefix in aws");
				return callback(err);
			}
			const keys = _.map(data.Contents, entry => entry.Key);
			return s3Client.deleteMultiple(keys, callback);
		});
	},

	checkIfFileExists(bucketName, key, callback){
		logger.log({bucketName, key}, "checking if file exists in s3");
		const options = buildDefaultOptions(bucketName, "head", key);
		return request(options, function(err, res){
			if (err != null) {
				logger.err({err, res, bucketName, key}, "something went wrong checking file in aws");
				return callback(err);
			}
			if ((res == null)) {
				logger.err({err, res, bucketName, key}, "no response object returned when checking if file exists");
				err = new Error(`no response from s3 ${bucketName} ${key}`);
				return callback(err);
			}
			const exists = res.statusCode === 200;
			logger.log({bucketName, key, exists}, "checked if file exsists in s3");
			return callback(err, exists);
		});
	},

	directorySize(bucketName, key, callback){
		logger.log({bucketName, key}, "get project size in s3");
		const s3Client = getKnoxClient(bucketName);
		return s3Client.list({prefix:key}, function(err, data){
			if (err != null) {
				logger.err({err, bucketName, key}, "something went wrong listing prefix in aws");
				return callback(err);
			}
			let totalSize = 0;
			_.each(data.Contents, entry => totalSize += entry.Size);
			logger.log({totalSize}, "total size");
			return callback(null, totalSize);
		});
	}
};
