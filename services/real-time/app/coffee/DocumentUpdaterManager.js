/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let DocumentUpdaterManager;
const request = require("request");
const _ = require("underscore");
const logger = require("logger-sharelatex");
const settings = require("settings-sharelatex");
const metrics = require("metrics-sharelatex");

const rclient = require("redis-sharelatex").createClient(settings.redis.documentupdater);
const Keys = settings.redis.documentupdater.key_schema;

module.exports = (DocumentUpdaterManager = {
	getDocument(project_id, doc_id, fromVersion, callback) {
		if (callback == null) { callback = function(error, exists, doclines, version) {}; }
		const timer = new metrics.Timer("get-document");
		const url = `${settings.apis.documentupdater.url}/project/${project_id}/doc/${doc_id}?fromVersion=${fromVersion}`;
		logger.log({project_id, doc_id, fromVersion}, "getting doc from document updater");
		return request.get(url, function(err, res, body) {
			timer.done();
			if (err != null) {
				logger.error({err, url, project_id, doc_id}, "error getting doc from doc updater");
				return callback(err);
			}
			if (200 <= res.statusCode && res.statusCode < 300) {
				logger.log({project_id, doc_id}, "got doc from document document updater");
				try {
					body = JSON.parse(body);
				} catch (error) {
					return callback(error);
				}
				return callback(null, body != null ? body.lines : undefined, body != null ? body.version : undefined, body != null ? body.ranges : undefined, body != null ? body.ops : undefined);
			} else if ([404, 422].includes(res.statusCode)) {
				err = new Error("doc updater could not load requested ops");
				err.statusCode = res.statusCode;
				logger.warn({err, project_id, doc_id, url, fromVersion}, "doc updater could not load requested ops");
				return callback(err);
			} else {
				err = new Error(`doc updater returned a non-success status code: ${res.statusCode}`);
				err.statusCode = res.statusCode;
				logger.error({err, project_id, doc_id, url}, `doc updater returned a non-success status code: ${res.statusCode}`);
				return callback(err);
			}
		});
	},

	flushProjectToMongoAndDelete(project_id, callback) {
		// this method is called when the last connected user leaves the project
		if (callback == null) { callback = function(){}; }
		logger.log({project_id}, "deleting project from document updater");
		const timer = new metrics.Timer("delete.mongo.project");
		// flush the project in the background when all users have left
		const url = `${settings.apis.documentupdater.url}/project/${project_id}?background=true` +
			(settings.shutDownInProgress ? "&shutdown=true" : "");
		return request.del(url, function(err, res, body){
			timer.done();
			if (err != null) {
				logger.error({err, project_id}, "error deleting project from document updater");
				return callback(err);
			} else if (200 <= res.statusCode && res.statusCode  < 300) {
				logger.log({project_id}, "deleted project from document updater");
				return callback(null);
			} else {
				err = new Error(`document updater returned a failure status code: ${res.statusCode}`);
				err.statusCode = res.statusCode;
				logger.error({err, project_id}, `document updater returned failure status code: ${res.statusCode}`);
				return callback(err);
			}
		});
	},

	queueChange(project_id, doc_id, change, callback){
		let error;
		if (callback == null) { callback = function(){}; }
		const allowedKeys = [ 'doc', 'op', 'v', 'dupIfSource', 'meta', 'lastV', 'hash'];
		change = _.pick(change, allowedKeys);
		const jsonChange = JSON.stringify(change);
		if (jsonChange.indexOf("\u0000") !== -1) {
			// memory corruption check
			error = new Error("null bytes found in op");
			logger.error({err: error, project_id, doc_id, jsonChange}, error.message);
			return callback(error);
		}

		const updateSize = jsonChange.length;
		if (updateSize > settings.maxUpdateSize) {
			error = new Error("update is too large");
			error.updateSize = updateSize;
			return callback(error);
		}

		// record metric for each update added to queue
		metrics.summary('redis.pendingUpdates', updateSize, {status: 'push'});

		const doc_key = `${project_id}:${doc_id}`;
		// Push onto pendingUpdates for doc_id first, because once the doc updater
		// gets an entry on pending-updates-list, it starts processing.
		return rclient.rpush(Keys.pendingUpdates({doc_id}), jsonChange, function(error) {
			if (error != null) { return callback(error); }
			return rclient.rpush("pending-updates-list", doc_key, callback);
		});
	}
});
