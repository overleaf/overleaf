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

	getProjectDocs: (project_id, projectStateHash, excludeVersions = {}, _callback = (error) ->) ->
		timer = new Metrics.Timer("projectManager.getProjectDocs")
		callback = (args...) ->
			timer.done()
			_callback(args...)

		RedisManager.checkOrSetProjectState project_id, projectStateHash, (error, projectStateChanged) ->
			return callback(error) if error?
			# we can't return docs if project structure has changed
			return callback Errors.ProjectStateChangedError("project state changed") if projectStateChanged
			# project structure hasn't changed, return doc content from redis
			RedisManager.getDocIdsInProject project_id, (error, doc_ids) ->
				return callback(error) if error?
				jobs = []
				docs = []
				for doc_id in doc_ids or []
					do (doc_id) ->
						jobs.push (cb) ->
							# check the doc version first
							RedisManager.getDocVersion doc_id, (error, version) ->
								return cb(error) if error?
								# skip getting the doc if we already have that version
								return cb() if version is excludeVersions[doc_id]
								# otherwise get the doc lines from redis
								RedisManager.getDocLines doc_id, (error, lines) ->
									return cb(error) if error?
									docs.push {_id: doc_id, lines: lines, v: version}
									cb()
				async.series jobs, (error) ->
					return callback(error) if error?
					callback(null, docs)
