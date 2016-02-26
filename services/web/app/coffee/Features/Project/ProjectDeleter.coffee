Project = require('../../models/Project').Project
ProjectGetter = require("./ProjectGetter")
logger = require('logger-sharelatex')
documentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
tagsHandler = require("../Tags/TagsHandler")
async = require("async")
FileStoreHandler = require("../FileStore/FileStoreHandler")

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

	deleteUsersProjects: (owner_id, callback)->
		logger.log owner_id:owner_id, "deleting users projects"
		Project.remove owner_ref:owner_id, callback

	deleteProject: (project_id, callback = (error) ->) ->
		# archiveProject takes care of the clean-up
		ProjectDeleter.archiveProject project_id, (error) ->
			logger.log project_id: project_id, "deleting project"
			Project.remove _id: project_id, callback

	archiveProject: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "deleting project"
		ProjectGetter.getProject project_id, {owner_ref:1, collaberator_refs:1, readOnly_refs:1}, (err, project)=>
			if err? or !project?
				logger.err err:err, project_id:project_id, "error getting project to delete it"
				callback(err)
			else
				async.series [
					(cb)->
						documentUpdaterHandler.flushProjectToMongoAndDelete project_id, cb
					(cb)->
						tagsHandler.removeProjectFromAllTags project.owner_ref, project_id, (err)->
						cb() #doesn't matter if this fails or the order it happens in
					(cb)->
						project.collaberator_refs.forEach (collaberator_ref)->
							tagsHandler.removeProjectFromAllTags collaberator_ref, project_id, ->
						cb()
					(cb)->
						project.readOnly_refs.forEach (readOnly_ref)->
							tagsHandler.removeProjectFromAllTags readOnly_ref, project_id, ->
						cb()
					(cb)->
						Project.update {_id:project_id}, { $set: { archived: true }}, cb
				], (err)->
					if err?
						logger.err err:err, "problem deleting project"
					callback(err)

	restoreProject: (project_id, callback = (error) ->) ->
		Project.update {_id:project_id}, { $unset: { archived: true }}, callback
