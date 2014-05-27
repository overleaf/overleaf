updateMerger = require('./UpdateMerger')
logger = require('logger-sharelatex')
projectLocator = require('../Project/ProjectLocator')
projectCreationHandler = require('../Project/ProjectCreationHandler')
projectDeleter = require('../Project/ProjectDeleter')
ProjectRootDocManager   = require "../Project/ProjectRootDocManager"

commitMessage = "Before update from Dropbox"

module.exports =

	newUpdate: (user_id, projectName, path, updateRequest, sl_req_id, callback)->
		getOrCreateProject = (cb)=>
			projectLocator.findUsersProjectByName user_id, projectName, (err, project)=>
				logger.log user_id:user_id, filePath:path, projectName:projectName, "handling new update from tpds"
				if !project?
					projectCreationHandler.createBlankProject user_id, projectName, (err, project)=>
						# have a crack at setting the root doc after a while, on creation we won't have it yet, but should have
						# been sent it it within 30 seconds
						setTimeout (-> ProjectRootDocManager.setRootDocAutomatically project._id, sl_req_id ), @_rootDocTimeoutLength
						cb err, project
				else
					cb err, project
		getOrCreateProject (err, project)->
			updateMerger.mergeUpdate project._id, path, updateRequest, sl_req_id, (err)->
				callback(err)


	deleteUpdate: (user_id, projectName, path, sl_req_id, callback)->	
		logger.log user_id:user_id, filePath:path, "handling delete update from tpds"
		projectLocator.findUsersProjectByName user_id, projectName, (err, project)->
			if !project?
				logger.log user_id:user_id, filePath:path, projectName:projectName, "project not found from tpds update, ignoring folder or project"
				return callback()
			if path == "/"
				logger.log user_id:user_id, filePath:path, projectName:projectName, project_id:project._id, "project found for delete update, path is root so marking project as deleted"
				return projectDeleter.markAsDeletedByExternalSource project._id, callback
			else
				updateMerger.deleteUpdate project._id, path, sl_req_id, (err)->
					callback(err)


	_rootDocTimeoutLength : 30 * 1000
