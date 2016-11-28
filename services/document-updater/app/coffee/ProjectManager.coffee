RedisManager = require "./RedisManager"
DocumentManager = require "./DocumentManager"
async = require "async"
logger = require "logger-sharelatex"
Metrics = require "./Metrics"

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

	setTrackChangesWithLocks: (project_id, track_changes_on, _callback = (error) ->) ->
		timer = new Metrics.Timer("projectManager.toggleTrackChangesWithLocks")
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
						DocumentManager.setTrackChangesWithLock project_id, doc_id, track_changes_on, (error) ->
							if error?
								logger.error {err: error, project_id, doc_ids, track_changes_on}, "error toggle track changes for doc"
								errors.push(error)
							callback()
			# TODO: If no docs, turn on track changes in Mongo manually

			logger.log {project_id, doc_ids, track_changes_on}, "toggling track changes for docs"
			async.series jobs, () ->
				if errors.length > 0
					callback new Error("Errors toggling track changes for docs. See log for details")
				else
					callback(null)
		
