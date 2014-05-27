Project = require('../../models/Project').Project
logger = require('logger-sharelatex')
documentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
tagsHandler = require("../Tags/TagsHandler")
async = require("async")
FileStoreHandler = require("../FileStore/FileStoreHandler")

module.exports =

	markAsDeletedByExternalSource : (project_id, callback)->
		logger.log project_id:project_id, "marking project as deleted by external data source"
		conditions = {_id:project_id}
		update = {deletedByExternalDataSource:true}

		Project.update conditions, update, {}, (err)->
			require('../Editor/EditorController').notifyUsersProjectHasBeenDeletedOrRenamed project_id, ->
				callback()

	deleteUsersProjects: (owner_id, callback)->
		logger.log owner_id:owner_id, "deleting users projects"
		Project.remove owner_ref:owner_id, callback


	deleteProject: (project_id, callback = (error) ->)->
		logger.log project_id:project_id, "deleting project"
		Project.findById project_id, (err, project)=>
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
