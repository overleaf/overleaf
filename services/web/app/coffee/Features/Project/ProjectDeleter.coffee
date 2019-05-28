Project = require('../../models/Project').Project
DeletedProject = require('../../models/DeletedProject').DeletedProject
logger = require('logger-sharelatex')
documentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
tagsHandler = require("../Tags/TagsHandler")
async = require("async")
FileStoreHandler = require("../FileStore/FileStoreHandler")
CollaboratorsHandler = require("../Collaborators/CollaboratorsHandler")

module.exports = ProjectDeleter =

	markAsDeletedByExternalSource : (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "marking project as deleted by external data source"
		conditions = {_id:project_id}
		update = {deletedByExternalDataSource:true}

		Project.update conditions, update, {}, (err)->
			require('../Editor/EditorController').notifyUsersProjectHasBeenDeletedOrRenamed project_id, ->
				callback()

	unmarkAsDeletedByExternalSource: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "removing flag marking project as deleted by external data source"
		conditions = {_id:project_id.toString()}
		update = {deletedByExternalDataSource: false}
		Project.update conditions, update, {}, callback

	deleteUsersProjects: (user_id, callback) ->
		logger.log {user_id}, "deleting users projects"

		Project.find {owner_ref: user_id}, (error, projects) ->
			return callback(error) if error?
			async.each(
				projects,
				(project, cb) ->
					ProjectDeleter.deleteProject project._id, cb
				(err) ->
					return callback(err) if err?
					CollaboratorsHandler.removeUserFromAllProjets user_id, callback
			)

	deleteProject: (project_id, options = {}, callback = (error) ->) ->
		data = {}
		logger.log project_id: project_id, "deleting project"

		if typeof options == 'function'
			callback = options
			options = {}

		async.waterfall [
			(cb) ->
				Project.findOne {_id: project_id}, (err, project) -> cb(err, project)
			(project, cb) ->
				deletedProject = new DeletedProject()
				deletedProject.project = project
				deletedProject.deleterData =
					deletedAt: new Date()
					deleterId: options.deleterUser?._id
					deleterIpAddress: options.ipAddress

				return callback(new Errors.NotFoundError("project not found")) unless project?

				deletedProject.save (err) ->
					cb(err, deletedProject)
			(deletedProject, cb) ->
				documentUpdaterHandler.flushProjectToMongoAndDelete project_id, (err) ->
					cb(err, deletedProject)
			(deletedProject, cb) ->
				CollaboratorsHandler.getMemberIds project_id, (error, member_ids = []) ->
					for member_id in member_ids
						tagsHandler.removeProjectFromAllTags member_id, project_id, (err)->
				cb(null, deletedProject) #doesn't matter if this fails or the order it happens in
			(deletedProject, cb) ->
				Project.remove _id: project_id, (err) ->
					cb(err, deletedProject)
		], (err, deletedProject) ->
			if err?
				logger.err err:err, "problem deleting project"
				return callback(err)
			logger.log project_id:project_id, "successfully deleting project from user request"
			callback(null, deletedProject)

	archiveProject: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "archived project from user request"
		Project.update {_id:project_id}, { $set: { archived: true }}, (err)->
			if err?
				logger.err err:err, "problem archived project"
				return callback(err)
			logger.log project_id:project_id, "successfully archived project from user request"
			callback()

	restoreProject: (project_id, callback = (error) ->) ->
		Project.update {_id:project_id}, { $unset: { archived: true }}, callback
