settings = require('settings-sharelatex')
logger = require('logger-sharelatex')
slReqIdHelper = require('soa-req-id')
path = require('path')
Project = require('../../models/Project').Project
keys = require('../../infrastructure/Keys')
metrics = require("../../infrastructure/Metrics")

buildPath = (user_id, project_name, filePath)->
	projectPath = path.join(project_name, "/", filePath)
	projectPath = encodeURIComponent(projectPath)
	fullPath = path.join("/user/", "#{user_id}", "/entity/",projectPath)
	return fullPath

queue = require('fairy').connect(settings.redis.fairy).queue(keys.queue.web_to_tpds_http_requests)

module.exports =

	_addEntity: (options, sl_req_id, callback = (err)->)->
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, sl_req_id:sl_req_id, rev:options.rev, "sending file to third party data store"
			postOptions =
				method : "post"
				headers: 
					"sl_req_id":sl_req_id
					sl_entity_rev:options.rev
					sl_project_id:options.project_id
					sl_all_user_ids:JSON.stringify(allUserIds)
				uri : "#{settings.apis.thirdPartyDataStore.url}#{buildPath(user_id, options.project_name, options.path)}" 
				title: "addFile"
				streamOrigin : options.streamOrigin
			queue.enqueue options.project_id, "pipeStreamFrom", postOptions, ->
				logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri, sl_req_id:sl_req_id, rev:options.rev, "sending file to third party data store queued up for processing"
				callback()
	
	addFile : (options, sl_req_id, callback = (err)->)->
		metrics.inc("tpds.add-file")
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		options.streamOrigin = settings.apis.filestore.url + path.join("/project/#{options.project_id}/file/","#{options.file_id}")
		@_addEntity(options, sl_req_id, callback)

	addDoc : (options, sl_req_id, callback = (err)->)->
		metrics.inc("tpds.add-doc")
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		options.streamOrigin = settings.apis.docstore.url + path.join("/project/#{options.project_id}/doc/","#{options.doc_id}")
		@_addEntity(options, sl_req_id, callback)
  

	moveEntity : (options, sl_req_id, callback = (err)->)->
		metrics.inc("tpds.move-entity")
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		if options.newProjectName?
			startPath = path.join("/#{options.project_name}/")
			endPath = path.join("/#{options.newProjectName}/")
		else
			startPath = mergeProjectNameAndPath(options.project_name, options.startPath)
			endPath = mergeProjectNameAndPath(options.project_name, options.endPath)
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			logger.log project_id: options.project_id, user_id:user_id, startPath:startPath, endPath:endPath, uri:options.uri, sl_req_id:sl_req_id,  "moving entity in third party data store"
			moveOptions =
				method : "put"
				title:"moveEntity"
				uri : "#{settings.apis.thirdPartyDataStore.url}/user/#{user_id}/entity"
				headers: 
					"sl_req_id":sl_req_id, 
					sl_project_id:options.project_id, 
					sl_entity_rev:options.rev
					sl_all_user_ids:JSON.stringify(allUserIds)
				json :
					user_id : user_id
					endPath: endPath 
					startPath: startPath 
			queue.enqueue options.project_id, "standardHttpRequest", moveOptions, callback

	deleteEntity : (options, sl_req_id, callback = (err)->)->
		metrics.inc("tpds.delete-entity")
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		getProjectsUsersIds options.project_id, (err, user_id, allUserIds)->
			logger.log project_id: options.project_id, user_id:user_id, path: options.path, uri:options.uri,  sl_req_id:sl_req_id, "deleting entity in third party data store"
			deleteOptions =
				method : "DELETE"
				headers: 
					"sl_req_id":sl_req_id, 
					sl_project_id:options.project_id
					sl_all_user_ids:JSON.stringify(allUserIds)
				uri : "#{settings.apis.thirdPartyDataStore.url}#{buildPath(user_id, options.project_name, options.path)}"
				title:"deleteEntity"
				sl_all_user_ids:JSON.stringify(allUserIds)
			queue.enqueue options.project_id, "standardHttpRequest", deleteOptions, callback


getProjectsUsersIds = (project_id, callback = (err, owner_id, allUserIds)->)->
	Project.findById project_id, "_id owner_ref readOnly_refs collaberator_refs", (err, project)->
		allUserIds = [].concat(project.collaberator_refs).concat(project.readOnly_refs).concat(project.owner_ref)
		callback err, project.owner_ref, allUserIds

mergeProjectNameAndPath = (project_name, path)->
	if(path.indexOf('/') == 0)
		path = path.substring(1)
	fullPath = "/#{project_name}/#{path}"
	return fullPath
