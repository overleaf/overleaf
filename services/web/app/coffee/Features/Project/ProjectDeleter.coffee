Project = require('../../models/Project').Project
logger = require('logger-sharelatex')
editorController = require('../Editor/EditorController')


module.exports =

	markAsDeletedByExternalSource : (project_id, callback)->
		logger.log project_id:project_id, "marking project as deleted by external data source"
		conditions = {_id:project_id}
		update = {deletedByExternalDataSource:true}

		Project.update conditions, update, {}, (err)->
			editorController.notifyUsersProjectHasBeenDeletedOrRenamed project_id, ->
				callback()

	deleteUsersProjects: (owner_id, callback)->
		logger.log owner_id:owner_id, "deleting users projects"
		Project.remove owner_ref:owner_id, callback
