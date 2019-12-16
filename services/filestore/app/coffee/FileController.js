/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let FileController;
const PersistorManager = require("./PersistorManager");
const settings = require("settings-sharelatex");
const logger = require("logger-sharelatex");
const FileHandler = require("./FileHandler");
const metrics = require("metrics-sharelatex");
const parseRange = require('range-parser');
const Errors = require('./Errors');

const oneDayInSeconds = 60 * 60 * 24;
const maxSizeInBytes = 1024 * 1024 * 1024; // 1GB

module.exports = (FileController = {

	getFile(req, res){
		const {key, bucket} = req;
		const {format, style} = req.query;
		const options = {
			key,
			bucket,
			format,
			style,
		};
		metrics.inc("getFile");
		logger.log({key, bucket, format, style}, "receiving request to get file");
		if (req.headers.range != null) {
			const range = FileController._get_range(req.headers.range);
			options.start = range.start;
			options.end = range.end;
			logger.log({start: range.start, end: range.end}, "getting range of bytes from file");
		}
		return FileHandler.getFile(bucket, key, options, function(err, fileStream){
			if (err != null) {
				if (err instanceof Errors.NotFoundError) {
					return res.send(404);
				} else {
					logger.err({err, key, bucket, format, style}, "problem getting file");
					return res.send(500);
				}
			} else if (req.query.cacheWarm) {
				logger.log({key, bucket, format, style}, "request is only for cache warm so not sending stream");
				return res.send(200);
			} else {
				logger.log({key, bucket, format, style}, "sending file to response");
				return fileStream.pipe(res);
			}
		});
	},

	getFileHead(req, res) {
		const {key, bucket} = req;
		metrics.inc("getFileSize");
		logger.log({ key, bucket }, "receiving request to get file metadata");
		return FileHandler.getFileSize(bucket, key, function(err, fileSize) {
			if (err != null) {
				if (err instanceof Errors.NotFoundError) {
					res.status(404).end();
				} else {
					res.status(500).end();
				}
				return;
			}
			res.set("Content-Length", fileSize);
			return res.status(200).end();
		});
	},

	insertFile(req, res){
		metrics.inc("insertFile");
		const {key, bucket} = req;
		logger.log({key, bucket}, "receiving request to insert file");
		return FileHandler.insertFile(bucket, key, req, function(err){
			if (err != null) {
				logger.log({err, key, bucket}, "error inserting file");
				return res.send(500);
			} else {
				return res.send(200);
			}
		});
	},

	copyFile(req, res){
		metrics.inc("copyFile");
		const {key, bucket} = req;
		const oldProject_id = req.body.source.project_id;
		const oldFile_id = req.body.source.file_id;
		logger.log({key, bucket, oldProject_id, oldFile_id}, "receiving request to copy file");
		return PersistorManager.copyFile(bucket, `${oldProject_id}/${oldFile_id}`, key, function(err){
			if (err != null) {
				if (err instanceof Errors.NotFoundError) {
					return res.send(404);
				} else {
					logger.log({err, oldProject_id, oldFile_id}, "something went wrong copying file");
					return res.send(500);
				}
			} else {
				return res.send(200);
			}
		});
	},

	deleteFile(req, res){
		metrics.inc("deleteFile");
		const {key, bucket} = req;
		logger.log({key, bucket},  "receiving request to delete file");
		return FileHandler.deleteFile(bucket, key, function(err){
			if (err != null) {
				logger.log({err, key, bucket}, "something went wrong deleting file");
				return res.send(500);
			} else {
				return res.send(204);
			}
		});
	},

	_get_range(header) {
		const parsed = parseRange(maxSizeInBytes, header);
		if ((parsed === -1) || (parsed === -2) || (parsed.type !== 'bytes')) {
			return null;
		} else {
			const range = parsed[0];
			return {start: range.start, end: range.end};
		}
	},

	directorySize(req, res){
		metrics.inc("projectSize");
		const {project_id, bucket} = req;
		logger.log({project_id, bucket}, "receiving request to project size");
		return FileHandler.getDirectorySize(bucket, project_id, function(err, size){
			if (err != null) {
				logger.log({err, project_id, bucket}, "error inserting file");
				return res.send(500);
			} else {
				return res.json({'total bytes' : size});
			}
	});
	}
});
