// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const fs = require("fs-extra");
const path = require("path");
const async = require("async");
const fileConverter = require("./FileConverter");
const keyBuilder = require("./KeyBuilder");
const fileController = require("./FileController");
const logger = require('logger-sharelatex');
const settings = require("settings-sharelatex");
const streamBuffers = require("stream-buffers");
const _ = require('underscore');


const checkCanStoreFiles = function(callback){
	callback = _.once(callback);
	const req = {params:{}, query:{}, headers:{}};
	req.params.project_id = settings.health_check.project_id;
	req.params.file_id = settings.health_check.file_id;
	const myWritableStreamBuffer = new streamBuffers.WritableStreamBuffer({initialSize: 100});
	const res = {
		send(code) {
			if (code !== 200) {
				return callback(new Error(`non-200 code from getFile: ${code}`));
			}
		}
	};
	myWritableStreamBuffer.send = res.send;
	return keyBuilder.userFileKey(req, res, function() {
		fileController.getFile(req, myWritableStreamBuffer);
		return myWritableStreamBuffer.on("close", function() {
			if (myWritableStreamBuffer.size() > 0) {
				return callback();
			} else {
				const err = "no data in write stream buffer for health check";
				logger.err({err,}, "error performing health check");
				return callback(err);
			}
		});
	});
};

const checkFileConvert = function(callback){
	if (!settings.enableConversions) {
		return callback();
	}
	const imgPath = path.join(settings.path.uploadFolder, "/tiny.pdf");
	return async.waterfall([
		cb => fs.copy("./tiny.pdf", imgPath, cb),
		cb => fileConverter.thumbnail(imgPath, cb),
		(resultPath, cb) => fs.unlink(resultPath, cb),
		cb => fs.unlink(imgPath, cb)
	], callback);
};


module.exports = {

	check(req, res) {
		logger.log({}, "performing health check");
		return async.parallel([checkFileConvert, checkCanStoreFiles], function(err){
			if (err != null) {
				logger.err({err}, "Health check: error running");
				return res.send(500);
			} else {
				return res.send(200);
			}
		});
	}
};
