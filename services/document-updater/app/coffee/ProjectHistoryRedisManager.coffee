Settings = require('settings-sharelatex')
projectHistoryKeys = Settings.redis?.project_history?.key_schema
rclient = require("redis-sharelatex").createClient(Settings.redis.project_history)
logger = require('logger-sharelatex')
metrics = require('./Metrics')

module.exports = ProjectHistoryRedisManager =
	queueOps: (project_id, ops..., callback = (error, projectUpdateCount) ->) ->
		# Record metric for ops pushed onto queue
		for op in ops
			metrics.summary "redis.projectHistoryOps", op.length, {status: "push"}
		multi = rclient.multi()
		# Push the ops onto the project history queue
		multi.rpush projectHistoryKeys.projectHistoryOps({project_id}), ops...
		# To record the age of the oldest op on the queue set a timestamp if not
		# already present (SETNX).
		multi.setnx projectHistoryKeys.projectHistoryFirstOpTimestamp({project_id}), Date.now()
		multi.exec (error, result) ->
			return callback(error) if error?
			# return the number of entries pushed onto the project history queue
			callback null, result[0]


	queueRenameEntity: (project_id, projectHistoryId, entity_type, entity_id, user_id, projectUpdate, callback) ->
		projectUpdate =
			pathname: projectUpdate.pathname
			new_pathname: projectUpdate.newPathname
			meta:
				user_id: user_id
				ts: new Date()
			version: projectUpdate.version
			projectHistoryId: projectHistoryId
		projectUpdate[entity_type] = entity_id

		logger.log {project_id, projectUpdate}, "queue rename operation to project-history"
		jsonUpdate = JSON.stringify(projectUpdate)

		ProjectHistoryRedisManager.queueOps project_id, jsonUpdate, callback

	queueAddEntity: (project_id, projectHistoryId, entity_type, entitiy_id, user_id, projectUpdate, callback = (error) ->) ->
		projectUpdate =
			pathname: projectUpdate.pathname
			docLines: projectUpdate.docLines
			url: projectUpdate.url
			meta:
				user_id: user_id
				ts: new Date()
			version: projectUpdate.version
			projectHistoryId: projectHistoryId
		projectUpdate[entity_type] = entitiy_id

		logger.log {project_id, projectUpdate}, "queue add operation to project-history"
		jsonUpdate = JSON.stringify(projectUpdate)

		ProjectHistoryRedisManager.queueOps project_id, jsonUpdate, callback

	queueResyncProjectStructure: (project_id, projectHistoryId, docs, files, callback) ->
		logger.log {project_id, docs, files}, "queue project structure resync"
		projectUpdate =
			resyncProjectStructure: { docs, files }
			projectHistoryId: projectHistoryId
			meta:
				ts: new Date()
		jsonUpdate = JSON.stringify projectUpdate
		ProjectHistoryRedisManager.queueOps project_id, jsonUpdate, callback

	queueResyncDocContent: (project_id, projectHistoryId, doc_id, lines, version, pathname, callback) ->
		logger.log {project_id, doc_id, lines, version, pathname}, "queue doc content resync"
		projectUpdate =
			resyncDocContent:
				content: lines.join("\n"),
				version: version
			projectHistoryId: projectHistoryId
			path: pathname
			doc: doc_id
			meta:
				ts: new Date()
		jsonUpdate = JSON.stringify projectUpdate
		ProjectHistoryRedisManager.queueOps project_id, jsonUpdate, callback
