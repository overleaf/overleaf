RedisManager = require "./RedisManager"
DocumentManager = require "./DocumentManager"
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
							if error?
								logger.error err: error, project_id: project_id, doc_id: doc_id, "error flushing doc"
								errors.push(error)
							callback()

			logger.log project_id: project_id, doc_ids: doc_ids, "flushing docs"
			async.series jobs, () ->
				if errors.length > 0
					callback new Error("Errors flushing docs. See log for details")
				else
					callback(null)

	flushAndDeleteProjectWithLocks: (project_id, _callback = (error) ->) ->
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
						DocumentManager.flushAndDeleteDocWithLock project_id, doc_id, (error) ->
							if error?
								logger.error err: error, project_id: project_id, doc_id: doc_id, "error deleting doc"
								errors.push(error)
							callback()

			logger.log project_id: project_id, doc_ids: doc_ids, "deleting docs"
			async.series jobs, () ->
				if errors.length > 0
					callback new Error("Errors deleting docs. See log for details")
				else
					callback(null)

	getProjectDocs: (project_id, projectStateHash, excludeVersions = {}, _callback = (error, docs) ->) ->
		timer = new Metrics.Timer("projectManager.getProjectDocs")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.checkOrSetProjectState project_id, projectStateHash, (error, projectStateChanged) ->
			if error?
				logger.error err: error, project_id: project_id, "error getting/setting project state in getProjectDocs"
				return callback(error)
			# we can't return docs if project structure has changed
			return callback Errors.ProjectStateChangedError("project state changed") if projectStateChanged
			# project structure hasn't changed, return doc content from redis
			RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
				if error?
					logger.error err: error, project_id: project_id, "error getting doc ids in getProjectDocs"
					return callback(error)
				jobs = []
				docs = []
				for doc_id in doc_ids or []
					do (doc_id) ->
						jobs.push (cb) ->
							# check the doc version first
							RedisManager.getDocVersion doc_id, (error, version) ->
								if error?
									logger.error err: error, project_id: project_id, doc_id: doc_id, "error getting project doc version in getProjectDocs"
									return cb(error)
								# skip getting the doc if we already have that version
								if version? and version is excludeVersions[doc_id]
									# not currently using excludeVersions so we shouldn't get here!
									# change to logger.log when this code path is in use
									logger.error err: error, project_id: project_id, doc_id: doc_id, version: version, "skipping doc version in getProjectDocs"
									return cb()
								# otherwise get the doc lines from redis
								RedisManager.getDocLines doc_id, (error, lines) ->
									if error?
										logger.error err: error, project_id: project_id, doc_id: doc_id, "error getting project doc lines in getProjectDocs"
										return cb(error)
									try
										docs.push {_id: doc_id, lines: JSON.parse(lines), v: version}
									catch e
										logger.error err: e, project_id: project_id, doc_id: doc_id, lines: lines, version: version, "error parsing doc lines in getProjectDocs"
										return cb(e)
									cb()
				async.series jobs, (error) ->
					return callback(error) if error?
					callback(null, docs)
