UrlCache = require "./UrlCache"
CompileManager = require "./CompileManager"
db = require "./db"
async = require "async"
logger = require "logger-sharelatex"
oneDay = 24 * 60 * 60 * 1000
Settings = require "settings-sharelatex"

module.exports = ProjectPersistenceManager =

	EXPIRY_TIMEOUT: Settings.project_cache_length_ms || oneDay * 2.5

	markProjectAsJustAccessed: (project_id, callback = (error) ->) ->
		db.Project.findOrCreate(where: {project_id: project_id})
			.spread(
				(project, created) ->
					project.updateAttributes(lastAccessed: new Date())
						.then(() -> callback())
						.error callback
			)
			.error callback

	clearExpiredProjects: (callback = (error) ->) ->
		ProjectPersistenceManager._findExpiredProjectIds (error, project_ids) ->
			return callback(error) if error?
			logger.log project_ids: project_ids, "clearing expired projects"
			jobs = for project_id in (project_ids or [])
				do (project_id) ->
					(callback) ->
						ProjectPersistenceManager.clearProject project_id, (err) ->
							if err?
								logger.error err: err, project_id: project_id, "error clearing project"
							callback()
			async.series jobs, callback

	clearProject: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "clearing project"
		CompileManager.clearProject project_id, (error) ->
			return callback(error) if error?
			UrlCache.clearProject project_id, (error) ->
				return callback(error) if error?
				ProjectPersistenceManager._clearProjectFromDatabase project_id, (error) ->
					return callback(error) if error?
					callback()

	_clearProjectFromDatabase: (project_id, callback = (error) ->) ->
		db.Project.destroy(where: {project_id: project_id})
			.then(() -> callback())
			.error callback

	_findExpiredProjectIds: (callback = (error, project_ids) ->) ->
		db.Project.findAll(where: ["lastAccessed < ?", new Date(Date.now() - ProjectPersistenceManager.EXPIRY_TIMEOUT)])
			.then((projects) ->
				callback null, projects.map((project) -> project.project_id)
			).error callback


logger.log EXPIRY_TIMEOUT:EXPIRY_TIMEOUT, "project assets kept timeout"