/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let BucketController;
const settings = require("settings-sharelatex");
const logger = require("logger-sharelatex");
const FileHandler = require("./FileHandler");
const metrics = require("metrics-sharelatex");
const Errors = require('./Errors');

module.exports = (BucketController = {

	getFile(req, res){
		const {bucket} = req.params;
		const key = req.params[0];
		const credentials = settings.filestore.s3BucketCreds != null ? settings.filestore.s3BucketCreds[bucket] : undefined;
		const options = {
			key,
			bucket,
			credentials
		};
		metrics.inc(`${bucket}.getFile`);
		logger.log({key, bucket}, "receiving request to get file from bucket");
		return FileHandler.getFile(bucket, key, options, function(err, fileStream){
			if (err != null) {
				logger.err({err, key, bucket}, "problem getting file from bucket");
				if (err instanceof Errors.NotFoundError) {
					return res.send(404);
				} else {
					return res.send(500);
				}
			} else {
				logger.log({key, bucket}, "sending bucket file to response");
				return fileStream.pipe(res);
			}
		});
	}
});
