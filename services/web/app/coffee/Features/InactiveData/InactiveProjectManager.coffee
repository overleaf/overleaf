async = require("async")
_ = require("underscore")
logger = require("logger-sharelatex")
DocstoreManager = require("../Docstore/DocstoreManager")
ProjectGetter = require("../Project/ProjectGetter")
ProjectUpdateHandler = require("../Project/ProjectUpdateHandler")
Project = require("../../models/Project").Project
TrackChangesManager = require("../TrackChanges/TrackChangesManager")


MILISECONDS_IN_DAY = 86400000
module.exports = InactiveProjectManager =

	reactivateProjectIfRequired: (project_id, callback)->
		ProjectGetter.getProject project_id, {active:true}, (err, project)->
			if err?
				logger.err err:err, project_id:project_id, "error getting project"
				return callback(err)
			logger.log project_id:project_id, active:project.active, "seeing if need to reactivate project"

			if project.active
				return callback()

			DocstoreManager.unarchiveProject project_id, (err)->
				if err?
					logger.err err:err, project_id:project_id, "error reactivating project in docstore"
					return callback(err)
				ProjectUpdateHandler.markAsActive project_id, callback

	deactivateOldProjects: (limit = 10, daysOld = 360, callback)->
		oldProjectDate = new Date() - (MILISECONDS_IN_DAY * daysOld)
		logger.log oldProjectDate:oldProjectDate, limit:limit, daysOld:daysOld, "starting process of deactivating old projects"
		Project.find()
			.where("lastOpened").lt(oldProjectDate)
			.where("active").equals(true)
			.select("_id")
			.limit(limit)
			.exec (err, projects)->
				if err?
					logger.err err:err, "could not get projects for deactivating"
				jobs = _.map projects, (project)->
					return (cb)->
						InactiveProjectManager.deactivateProject project._id, cb
				logger.log numberOfProjects:projects?.length, "deactivating projects"
				async.series jobs, (err)->
					if err?
						logger.err err:err, "error deactivating projects"
					callback err, projects


	deactivateProject: (project_id, callback)->
		logger.log project_id:project_id, "deactivating inactive project"
		jobs = [
			(cb)-> DocstoreManager.archiveProject project_id, cb
			# (cb)-> TrackChangesManager.archiveProject project_id, cb
			(cb)-> ProjectUpdateHandler.markAsInactive project_id, cb
		]
		async.series jobs, (err)->
			if err?
				logger.err err:err, project_id:project_id, "error deactivating project"
			callback(err)

