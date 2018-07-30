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
		console.log("markProjectAsJustAccessed")
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
						ProjectPersistenceManager.clearProjectFromCache project_id, (err) ->
							if err?
								logger.error err: err, project_id: project_id, "error clearing project"
							callback()
			async.series jobs, (error) ->
				return callback(error) if error?
				CompileManager.clearExpiredProjects ProjectPersistenceManager.EXPIRY_TIMEOUT, (error) ->
					callback() # ignore any errors from deleting directories

	clearProject: (project_id, user_id, callback = (error) ->) ->
		logger.log project_id: project_id, user_id:user_id, "clearing project for user"
		CompileManager.clearProject project_id, user_id, (error) ->
			return callback(error) if error?
			ProjectPersistenceManager.clearProjectFromCache project_id, (error) ->
				return callback(error) if error?
				callback()

	clearProjectFromCache: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "clearing project from cache"
		UrlCache.clearProject project_id, (error) ->
			return callback(error) if error?
			ProjectPersistenceManager._clearProjectFromDatabase project_id, (error) ->
				return callback(error) if error?
				callback()

	_clearProjectFromDatabase: (project_id, callback = (error) ->) ->
		console.log("_clearProjectFromDatabase")
		db.Project.destroy(where: {project_id: project_id})
			.then(() -> callback())
			.error callback

	_findExpiredProjectIds: (callback = (error, project_ids) ->) ->
		console.log("_findExpiredProjectIds")
		db.Project.findAll(where: ["lastAccessed < ?", new Date(Date.now() - ProjectPersistenceManager.EXPIRY_TIMEOUT)])
			.then((projects) ->
				callback null, projects.map((project) -> project.project_id)
			).error callback

logger.log {EXPIRY_TIMEOUT: ProjectPersistenceManager.EXPIRY_TIMEOUT}, "project assets kept timeout"
