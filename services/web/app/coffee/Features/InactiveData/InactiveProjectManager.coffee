async = require("async")
_ = require("lodash")
logger = require("logger-sharelatex")
DocstoreManager = require("../Docstore/DocstoreManager")
ProjectGetter = require("../Project/ProjectGetter")
ProjectUpdateHandler = require("../Project/ProjectUpdateHandler")
Project = require("../../models/Project").Project

MILISECONDS_IN_DAY = 86400000
module.exports = InactiveProjectManager =

	reactivateProjectIfRequired: (project_id, callback)->
		ProjectGetter.getProject project_id, {inactive:true}, (err, project)->
			if err?
				logger.err err:err, project_id:project_id, "error getting project"
				return callback(err)
			logger.log project_id:project_id, inactive:project.inactive, "seeing if need to reactivate project"

			if !project.inactive
				return callback()

			DocstoreManager.unarchiveProject project_id, (err)->
				if err?
					logger.err err:err, project_id:project_id, "error reactivating project in docstore"
					return callback(err)
				ProjectUpdateHandler.markAsActive project_id, callback

	deactivateOldProjects: (limit, callback)->

		sixMonthsAgo = new Date() - (MILISECONDS_IN_DAY * 1)
		Project.find()
			.where("lastOpened").lt(sixMonthsAgo)
			.where("inactive").ne(true)
			.select("_id")
			.limit(limit)
			.exec (err, projects)->
				if err?
					logger.err err:err, "could not get projects for deactivating"
				jobs = _.map projects, (project)->
					return (cb)->
						InactiveProjectManager.deactivateProject project._id, cb
				logger.log numberOfProjects:projects?.length, "deactivating projects"
				async.series jobs, callback


	deactivateProject: (project_id, callback)->
		logger.log project_id:project_id, "deactivating inactive project"
		DocstoreManager.archiveProject project_id, (err)->
			if err?
				logger.err err:err, project_id:project_id, "error deactivating project in docstore"
				return callback(err)
			ProjectUpdateHandler.markAsInactive project_id, callback

