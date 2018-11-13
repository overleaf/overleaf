Project = require('../../models/Project').Project
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

	deleteUsersProjects: (user_id, callback)->
		logger.log {user_id}, "deleting users projects"
		Project.remove owner_ref:user_id, (error) ->
			return callback(error) if error?
			CollaboratorsHandler.removeUserFromAllProjets user_id, callback

	deleteProject: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "deleting project"
		async.series [
			(cb)->
				documentUpdaterHandler.flushProjectToMongoAndDelete project_id, cb
			(cb)->
				CollaboratorsHandler.getMemberIds project_id, (error, member_ids = []) ->
					for member_id in member_ids
						tagsHandler.removeProjectFromAllTags member_id, project_id, (err)->
				cb() #doesn't matter if this fails or the order it happens in
			(cb) ->
				Project.remove _id: project_id, cb
		], (err) ->
			if err?
				logger.err err:err, "problem deleting project"
				return callback(err)
			logger.log project_id:project_id, "successfully deleting project from user request"
			callback()

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
