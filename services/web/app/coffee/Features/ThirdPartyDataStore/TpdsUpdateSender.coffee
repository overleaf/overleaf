settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
path = require('path')
Project = require('../../models/Project').Project
keys = require('../../infrastructure/Keys')
metrics = require("../../infrastructure/Metrics")
request = require("request")
CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')

buildPath = (user_id, project_name, filePath)->
	projectPath = path.join(project_name, "/", filePath)
	projectPath = encodeURIComponent(projectPath)
	fullPath = path.join("/user/", "#{user_id}", "/entity/",projectPath)
	return fullPath




tpdsworkerEnabled = -> settings.apis.tpdsworker?.url?
if !tpdsworkerEnabled()
	logger.log "tpdsworker is not enabled, request will not be sent to it"

module.exports = TpdsUpdateSender =

	_enqueue: (group, method, job, callback)->
		if !tpdsworkerEnabled()
			return callback()
		opts = 
			uri:"#{settings.apis.tpdsworker.url}/enqueue/web_to_tpds_http_requests"
			json :
				group:group
				method:method
				job:job
			method:"post"
			timeout: (5 * 1000)
		request opts, (err)->
			if err?
				logger.err err:err, "error queuing something in the tpdsworker"
				callback(err)
			else
				logger.log group:group, "successfully queued up job for tpdsworker"
				callback()

	_addEntity: (options, callback = (err)->)->
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			if err?
				logger.err err:err, options:options, "error getting projects user ids"
				return callback(err)
			logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, rev:options.rev, "sending file to third party data store"
			postOptions =
				method : "post"
				headers:
					sl_entity_rev:options.rev
					sl_project_id:options.project_id
					sl_all_user_ids:JSON.stringify(allUserIds)
				uri : "#{settings.apis.thirdPartyDataStore.url}#{buildPath(user_id, options.project_name, options.path)}" 
				title: "addFile"
				streamOrigin : options.streamOrigin
			TpdsUpdateSender._enqueue options.project_id, "pipeStreamFrom", postOptions, (err)->
				if err?
					logger.err err:err,  project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, rev:options.rev, "error sending file to third party data store queued up for processing"
					return callback(err)
				logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, rev:options.rev, "sending file to third party data store queued up for processing"
				callback(err)
	
	addFile : (options, callback = (err)->)->
		metrics.inc("tpds.add-file")
		options.streamOrigin = settings.apis.filestore.url + path.join("/project/#{options.project_id}/file/","#{options.file_id}")
		@_addEntity(options, callback)

	addDoc : (options, callback = (err)->)->
		metrics.inc("tpds.add-doc")
		options.streamOrigin = settings.apis.docstore.pubUrl + path.join("/project/#{options.project_id}/doc/","#{options.doc_id}/raw")
		@_addEntity(options, callback)
  

	moveEntity : (options, callback = (err)->)->
		metrics.inc("tpds.move-entity")
		if options.newProjectName?
			startPath = path.join("/#{options.project_name}/")
			endPath = path.join("/#{options.newProjectName}/")
		else
			startPath = mergeProjectNameAndPath(options.project_name, options.startPath)
			endPath = mergeProjectNameAndPath(options.project_name, options.endPath)
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			logger.log project_id: options.project_id, user_id:user_id, startPath:startPath, endPath:endPath, uri:options.uri, "moving entity in third party data store"
			moveOptions =
				method : "put"
				title:"moveEntity"
				uri : "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/entity"
				headers: 
					sl_project_id:options.project_id, 
					sl_entity_rev:options.rev
					sl_all_user_ids:JSON.stringify(allUserIds)
				json :
					user_id : user_id
					endPath: endPath 
					startPath: startPath 
			TpdsUpdateSender._enqueue options.project_id, "standardHttpRequest", moveOptions, callback

	deleteEntity : (options, callback = (err)->)->
		metrics.inc("tpds.delete-entity")
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, "deleting entity in third party data store"
			deleteOptions =
				method : "DELETE"
				headers:
					sl_project_id:options.project_id
					sl_all_user_ids:JSON.stringify(allUserIds)
				uri : "#{settings.apis.thirdPartyDataStore.url}#{buildPath(user_id, options.project_name, options.path)}"
				title:"deleteEntity"
				sl_all_user_ids:JSON.stringify(allUserIds)
			TpdsUpdateSender._enqueue options.project_id, "standardHttpRequest", deleteOptions, callback
			
	pollDropboxForUser: (user_id, callback = (err) ->) ->
		metrics.inc("tpds.poll-dropbox")
		logger.log user_id: user_id, "polling dropbox for user"
		options =
			method: "POST"
			uri:"#{settings.apis.thirdPartyDataStore.url}/user/poll"
			json:
				user_ids: [user_id]
		TpdsUpdateSender._enqueue "poll-dropbox:#{user_id}", "standardHttpRequest", options, callback

getProjectsUsersIds = (project_id, callback = (err, owner_id, allUserIds)->)->
	Project.findById project_id, "_id owner_ref", (err, project) ->
		return callback(err) if err?
		CollaboratorsHandler.getMemberIds project_id, (err, member_ids) ->
			return callback(err) if err?
			callback err, project?.owner_ref, member_ids

mergeProjectNameAndPath = (project_name, path)->
	if(path.indexOf('/') == 0)
		path = path.substring(1)
	fullPath = "/#{project_name}/#{path}"
	return fullPath
