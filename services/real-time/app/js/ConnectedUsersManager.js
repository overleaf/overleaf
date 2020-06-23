/* eslint-disable
    camelcase,
    handle-callback-err,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const async = require("async");
const Settings = require('settings-sharelatex');
const logger = require("logger-sharelatex");
const redis = require("redis-sharelatex");
const rclient = redis.createClient(Settings.redis.realtime);
const Keys = Settings.redis.realtime.key_schema;

const ONE_HOUR_IN_S = 60 * 60;
const ONE_DAY_IN_S = ONE_HOUR_IN_S * 24;
const FOUR_DAYS_IN_S = ONE_DAY_IN_S * 4;

const USER_TIMEOUT_IN_S = ONE_HOUR_IN_S / 4;
const REFRESH_TIMEOUT_IN_S = 10;  // only show clients which have responded to a refresh request in the last 10 seconds

module.exports = {
	// Use the same method for when a user connects, and when a user sends a cursor
	// update. This way we don't care if the connected_user key has expired when
	// we receive a cursor update. 
	updateUserPosition(project_id, client_id, user, cursorData, callback){
		if (callback == null) { callback = function(err){}; }
		logger.log({project_id, client_id}, "marking user as joined or connected");

		const multi = rclient.multi();
		
		multi.sadd(Keys.clientsInProject({project_id}), client_id);
		multi.expire(Keys.clientsInProject({project_id}), FOUR_DAYS_IN_S);
		
		multi.hset(Keys.connectedUser({project_id, client_id}), "last_updated_at", Date.now());
		multi.hset(Keys.connectedUser({project_id, client_id}), "user_id", user._id);
		multi.hset(Keys.connectedUser({project_id, client_id}), "first_name", user.first_name || "");
		multi.hset(Keys.connectedUser({project_id, client_id}), "last_name", user.last_name || "");
		multi.hset(Keys.connectedUser({project_id, client_id}), "email", user.email || "");
		
		if (cursorData != null) {
			multi.hset(Keys.connectedUser({project_id, client_id}), "cursorData", JSON.stringify(cursorData));
		}
		multi.expire(Keys.connectedUser({project_id, client_id}), USER_TIMEOUT_IN_S);
		
		return multi.exec(function(err){
			if (err != null) {
				logger.err({err, project_id, client_id}, "problem marking user as connected");
			}
			return callback(err);
		});
	},

	refreshClient(project_id, client_id, callback) {
		if (callback == null) { callback = function(err) {}; }
		logger.log({project_id, client_id}, "refreshing connected client");
		const multi = rclient.multi();
		multi.hset(Keys.connectedUser({project_id, client_id}), "last_updated_at", Date.now());
		multi.expire(Keys.connectedUser({project_id, client_id}), USER_TIMEOUT_IN_S);
		return multi.exec(function(err){
			if (err != null) {
				logger.err({err, project_id, client_id}, "problem refreshing connected client");
			}
			return callback(err);
		});
	},

	markUserAsDisconnected(project_id, client_id, callback){
		logger.log({project_id, client_id}, "marking user as disconnected");
		const multi = rclient.multi();
		multi.srem(Keys.clientsInProject({project_id}), client_id);
		multi.expire(Keys.clientsInProject({project_id}), FOUR_DAYS_IN_S);
		multi.del(Keys.connectedUser({project_id, client_id}));
		return multi.exec(callback);
	},


	_getConnectedUser(project_id, client_id, callback){
		return rclient.hgetall(Keys.connectedUser({project_id, client_id}), function(err, result){
			if ((result == null) || (Object.keys(result).length === 0) || !result.user_id) {
				result = {
					connected : false,
					client_id
				};
			} else {
				result.connected = true;
				result.client_id = client_id;
				result.client_age = (Date.now() - parseInt(result.last_updated_at,10)) / 1000;
				if (result.cursorData != null) {
					try {
						result.cursorData = JSON.parse(result.cursorData);
					} catch (e) {
						logger.error({err: e, project_id, client_id, cursorData: result.cursorData}, "error parsing cursorData JSON"); 
						return callback(e);
					}
				}
			}
			return callback(err, result);
		});
	},

	getConnectedUsers(project_id, callback){
		const self = this;
		return rclient.smembers(Keys.clientsInProject({project_id}), function(err, results){
			if (err != null) { return callback(err); }
			const jobs = results.map(client_id => cb => self._getConnectedUser(project_id, client_id, cb));
			return async.series(jobs, function(err, users){
				if (users == null) { users = []; }
				if (err != null) { return callback(err); }
				users = users.filter(user => (user != null ? user.connected : undefined) && ((user != null ? user.client_age : undefined) < REFRESH_TIMEOUT_IN_S));
				return callback(null, users);
			});
		});
	}
};

