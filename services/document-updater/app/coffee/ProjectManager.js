RedisManager = require "./RedisManager"
ProjectHistoryRedisManager = require "./ProjectHistoryRedisManager"
DocumentManager = require "./DocumentManager"
HistoryManager = require "./HistoryManager"
async = require "async"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"
Errors = require "./Errors"

module.exports = ProjectManager =
	flushProjectWithLocks: (project_id, _callback = (error) ->) ->
		timer = new Metrics.Timer("projectManager.flushProjectWithLocks")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
			return callback(error) if error?
			jobs = []
			errors = []
			for doc_id in (doc_ids or [])
				do (doc_id) ->
					jobs.push (callback) ->
						DocumentManager.flushDocIfLoadedWithLock project_id, doc_id, (error) ->
							if error? and error instanceof Errors.NotFoundError
								logger.warn err: error, project_id: project_id, doc_id: doc_id, "found deleted doc when flushing"
								callback()
							else if error?
								logger.error err: error, project_id: project_id, doc_id: doc_id, "error flushing doc"
								errors.push(error)
								callback()
							else
								callback()

			logger.log project_id: project_id, doc_ids: doc_ids, "flushing docs"
			async.series jobs, () ->
				if errors.length > 0
					callback new Error("Errors flushing docs. See log for details")
				else
					callback(null)

	flushAndDeleteProjectWithLocks: (project_id, options, _callback = (error) ->) ->
		timer = new Metrics.Timer("projectManager.flushAndDeleteProjectWithLocks")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
			return callback(error) if error?
			jobs = []
			errors = []
			for doc_id in (doc_ids or [])
				do (doc_id) ->
					jobs.push (callback) ->
						DocumentManager.flushAndDeleteDocWithLock project_id, doc_id, {}, (error) ->
							if error?
								logger.error err: error, project_id: project_id, doc_id: doc_id, "error deleting doc"
								errors.push(error)
							callback()

			logger.log project_id: project_id, doc_ids: doc_ids, "deleting docs"
			async.series jobs, () ->
				# When deleting the project here we want to ensure that project
				# history is completely flushed because the project may be
				# deleted in web after this call completes, and so further
				# attempts to flush would fail after that.
				HistoryManager.flushProjectChanges project_id, options, (error) ->
					if errors.length > 0
						callback new Error("Errors deleting docs. See log for details")
					else if error?
						callback(error)
					else
						callback(null)

	queueFlushAndDeleteProject: (project_id, callback = (error) ->) ->
		RedisManager.queueFlushAndDeleteProject project_id, (error) ->
			if error?
				logger.error {project_id: project_id, error:error}, "error adding project to flush and delete queue"
				return callback(error)
			Metrics.inc "queued-delete"
			callback()

	getProjectDocsTimestamps: (project_id, callback = (error) ->) ->
		RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
			return callback(error) if error?
			return callback(null, []) if !doc_ids?.length
			RedisManager.getDocTimestamps doc_ids, (error, timestamps) ->
				return callback(error) if error?
				callback(null, timestamps)

	getProjectDocsAndFlushIfOld: (project_id, projectStateHash, excludeVersions = {}, _callback = (error, docs) ->) ->
		timer = new Metrics.Timer("projectManager.getProjectDocsAndFlushIfOld")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.checkOrSetProjectState project_id, projectStateHash, (error, projectStateChanged) ->
			if error?
				logger.error err: error, project_id: project_id, "error getting/setting project state in getProjectDocsAndFlushIfOld"
				return callback(error)
			# we can't return docs if project structure has changed
			if projectStateChanged
				return callback Errors.ProjectStateChangedError("project state changed")
			# project structure hasn't changed, return doc content from redis
			RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
				if error?
					logger.error err: error, project_id: project_id, "error getting doc ids in getProjectDocs"
					return callback(error)
				jobs = []
				for doc_id in doc_ids or []
					do (doc_id) ->
						jobs.push (cb) ->
							# get the doc lines from redis
							DocumentManager.getDocAndFlushIfOldWithLock project_id, doc_id, (err, lines, version) ->
								if err?
									logger.error err:err, project_id: project_id, doc_id: doc_id, "error getting project doc lines in getProjectDocsAndFlushIfOld"
									return cb(err)
								doc = {_id:doc_id, lines:lines, v:version} # create a doc object to return
								cb(null, doc)
				async.series jobs, (error, docs) ->
					return callback(error) if error?
					callback(null, docs)

	clearProjectState: (project_id, callback = (error) ->) ->
		RedisManager.clearProjectState project_id, callback

	updateProjectWithLocks: (project_id, projectHistoryId, user_id, docUpdates, fileUpdates, version, _callback = (error) ->) ->
		timer = new Metrics.Timer("projectManager.updateProject")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		project_version = version 
		project_subversion = 0 		# project versions can have multiple operations

		project_ops_length = 0

		handleDocUpdate = (projectUpdate, cb) ->
			doc_id = projectUpdate.id
			projectUpdate.version = "#{project_version}.#{project_subversion++}"
			if projectUpdate.docLines?
				ProjectHistoryRedisManager.queueAddEntity project_id, projectHistoryId, 'doc', doc_id, user_id, projectUpdate, (error, count) ->
					project_ops_length = count
					cb(error)
			else
				DocumentManager.renameDocWithLock project_id, doc_id, user_id, projectUpdate, projectHistoryId, (error, count) ->
					project_ops_length = count
					cb(error)

		handleFileUpdate = (projectUpdate, cb) ->
			file_id = projectUpdate.id
			projectUpdate.version = "#{project_version}.#{project_subversion++}"
			if projectUpdate.url?
				ProjectHistoryRedisManager.queueAddEntity project_id, projectHistoryId, 'file', file_id, user_id, projectUpdate, (error, count) ->
					project_ops_length = count
					cb(error)
			else
				ProjectHistoryRedisManager.queueRenameEntity project_id, projectHistoryId, 'file', file_id, user_id, projectUpdate, (error, count) ->
					project_ops_length = count
					cb(error)

		async.eachSeries docUpdates, handleDocUpdate, (error) ->
			return callback(error) if error?
			async.eachSeries fileUpdates, handleFileUpdate, (error) ->
				return callback(error) if error?
				if HistoryManager.shouldFlushHistoryOps(project_ops_length, docUpdates.length + fileUpdates.length, HistoryManager.FLUSH_PROJECT_EVERY_N_OPS)
					HistoryManager.flushProjectChangesAsync project_id
				callback()
