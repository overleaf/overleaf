Keys = require("./RedisKeys")
Settings = require "settings-sharelatex"
redis = require('redis')
rclient = redis.createClient(Settings.redis.web.port, Settings.redis.web.host)
rclient.auth(Settings.redis.web.password)
VersioningApiHandler = require('../../Features/Versioning/VersioningApiHandler')
async = require('async')
metrics = require('../../infrastructure/Metrics')
logger = require('logger-sharelatex')


module.exports = AutomaticSnapshotManager =
	markProjectAsUpdated: (project_id, callback = (error) ->) ->
		rclient.set Keys.buildLastUpdatedKey(project_id), Date.now(), (error) ->
			return callback(error) if error?
			rclient.sadd Keys.projectsToSnapshotKey, project_id, (error) ->
				return callback(error) if error?
				callback()

	unmarkProjectAsUpdated: (project_id, callback = (err)->)->
		rclient.del Keys.buildLastUpdatedKey(project_id), Date.now(), (error) ->
			return callback(error) if error?
			rclient.srem Keys.projectsToSnapshotKey, project_id, (error) ->
				return callback(error) if error?
				callback()

	takeAutomaticSnapshots: (callback = (error) ->) ->
		rclient.smembers Keys.projectsToSnapshotKey, (error, project_ids) =>
			logger.log project_ids:project_ids, "taking automatic snapshots"
			metrics.gauge "versioning.projectsToSnapshot", project_ids.length
			return callback(error) if error?
			methods = []
			for project_id in project_ids
				do (project_id) =>
					methods.push((callback) => @takeSnapshotIfRequired(project_id, callback))
			async.series methods, callback

	takeSnapshotIfRequired: (project_id, callback = (error) ->) ->
		rclient.get Keys.buildLastUpdatedKey(project_id), (error, lastUpdated) ->
			return callback(error) if error?
			if lastUpdated? and lastUpdated < Date.now() - Settings.automaticSnapshots.waitTimeAfterLastEdit
				VersioningApiHandler.takeSnapshot(project_id, "Automatic snapshot", callback)
			else
				rclient.get Keys.buildLastSnapshotKey(project_id), (error, lastSnapshot) ->
					return callback(error) if error?
					if !lastSnapshot? or lastSnapshot < Date.now() - Settings.automaticSnapshots.maxTimeBetweenSnapshots
						VersioningApiHandler.takeSnapshot(project_id, "Automatic snapshot", callback)
					else
						callback()
			
