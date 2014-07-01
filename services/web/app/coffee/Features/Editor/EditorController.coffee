logger = require('logger-sharelatex')
Metrics = require('../../infrastructure/Metrics')
sanitize = require('sanitizer')
ProjectEditorHandler = require('../Project/ProjectEditorHandler')
ProjectEntityHandler = require('../Project/ProjectEntityHandler')
ProjectOptionsHandler = require('../Project/ProjectOptionsHandler')
ProjectDetailsHandler = require('../Project/ProjectDetailsHandler')
ProjectDeleter = require("../Project/ProjectDeleter")
ProjectGetter = require('../Project/ProjectGetter')
CollaboratorsHandler = require("../Collaborators/CollaboratorsHandler")
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
LimitationsManager = require("../Subscription/LimitationsManager")
AuthorizationManager = require("../Security/AuthorizationManager")
EditorRealTimeController = require("./EditorRealTimeController")
TrackChangesManager = require("../TrackChanges/TrackChangesManager")
settings = require('settings-sharelatex')
slReqIdHelper = require('soa-req-id')
tpdsPollingBackgroundTasks = require('../ThirdPartyDataStore/TpdsPollingBackgroundTasks')
async = require('async')
_ = require('underscore')
rclientPub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientPub.auth(settings.redis.web.password)
rclientSub = require("redis").createClient(settings.redis.web.port, settings.redis.web.host)
rclientSub.auth(settings.redis.web.password)

module.exports = EditorController =
	protocolVersion: 2

	reportError: (client, clientError, callback = () ->) ->
		client.get "project_id", (error, project_id) ->
			client.get "user_id", (error, user_id) ->
				logger.error err: clientError, project_id: project_id, user_id: user_id, "client error"
				callback()

	joinProject: (client, user, project_id, callback) ->
		logger.log user_id:user._id, project_id:project_id, "user joining project"
		Metrics.inc "editor.join-project"
		ProjectGetter.getProjectWithoutDocLines project_id, (error, project) ->
			return callback(error) if error?
			ProjectGetter.populateProjectWithUsers project, (error, project) ->
				return callback(error) if error?
				AuthorizationManager.getPrivilegeLevelForProject project, user,
					(error, canAccess, privilegeLevel) ->
						if error? or !canAccess
							callback new Error("Not authorized")
						else
							client.join(project_id)
							client.set("project_id", project_id)
							client.set("owner_id", project.owner_ref._id)
							client.set("user_id", user._id)
							client.set("first_name", user.first_name)
							client.set("last_name", user.last_name)
							client.set("email", user.email)
							client.set("connected_time", new Date())
							client.set("signup_date", user.signUpDate)
							client.set("login_count", user.loginCount)
							AuthorizationManager.setPrivilegeLevelOnClient client, privilegeLevel
							callback null, ProjectEditorHandler.buildProjectModelView(project), privilegeLevel, EditorController.protocolVersion

	leaveProject: (client, user) ->
		self = @
		client.get "project_id", (error, project_id) ->
			return if error? or !project_id?
			EditorRealTimeController.emitToRoom(project_id, "clientTracking.clientDisconnected", client.id)
			logger.log user_id:user._id, project_id:project_id, "user leaving project"
			self.flushProjectIfEmpty(project_id)

	joinDoc: (client, project_id, doc_id, fromVersion, callback = (error, docLines, version) ->) ->
		# fromVersion is optional
		if typeof fromVersion == "function"
			callback = fromVersion
			fromVersion = -1

		client.get "user_id", (error, user_id) ->
			logger.log user_id: user_id, project_id: project_id, doc_id: doc_id, "user joining doc"
		Metrics.inc "editor.join-doc"
		client.join doc_id
		DocumentUpdaterHandler.getDocument project_id, doc_id, fromVersion, (err, docLines, version, ops)->
			# Encode any binary bits of data so it can go via WebSockets
			# See http://ecmanaut.blogspot.co.uk/2006/07/encoding-decoding-utf8-in-javascript.html
			if docLines?
				docLines = for line in docLines
					if line.text?
						line.text = unescape(encodeURIComponent(line.text))
					else
						line = unescape(encodeURIComponent(line))
					line
			callback(err, docLines, version, ops)

	leaveDoc: (client, project_id, doc_id, callback = (error) ->) ->
		client.get "user_id", (error, user_id) ->
			logger.log user_id: user_id, project_id: project_id, doc_id: doc_id, "user leaving doc"
		Metrics.inc "editor.leave-doc"
		client.leave doc_id
		callback()

	flushProjectIfEmpty: (project_id, callback = ->)->
		setTimeout (->
			io = require('../../infrastructure/Server').io
			peopleStillInProject = io.sockets.clients(project_id).length
			logger.log project_id: project_id, connectedCount: peopleStillInProject, "flushing if empty"
			if peopleStillInProject == 0
				DocumentUpdaterHandler.flushProjectToMongoAndDelete(project_id)
				TrackChangesManager.flushProject(project_id)
			callback()
			), 500
		
	updateClientPosition: (client, cursorData, callback = (error) ->) ->
		client.get "project_id", (error, project_id) ->
			return callback(error) if error?
			client.get "first_name", (error, first_name) ->
				return callback(error) if error?
				client.get "last_name", (error, last_name) ->
					return callback(error) if error?
					client.get "email", (error, email) ->
						return callback(error) if error?
						client.get "user_id", (error, user_id) ->
							return callback(error) if error?
							cursorData.id = client.id
							cursorData.user_id = user_id if user_id?
							cursorData.email = email if email?
							if first_name? and last_name?
								cursorData.name = first_name + " " + last_name
							else
								cursorData.name = "Anonymous"
							EditorRealTimeController.emitToRoom(project_id, "clientTracking.clientUpdated", cursorData)

	addUserToProject: (project_id, email, privileges, callback = (error, collaborator_added)->)->
		email = email.toLowerCase()
		LimitationsManager.isCollaboratorLimitReached project_id, (error, limit_reached) =>
			if error?
				logger.error err:error, "error adding user to to project when checking if collaborator limit has been reached"
				return callback(new Error("Something went wrong"))

			if limit_reached
				callback null, false
			else
				CollaboratorsHandler.addUserToProject project_id, email, privileges, (err, user)=>
					ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, "", ->
					EditorRealTimeController.emitToRoom(project_id, 'userAddedToProject', user, privileges)
					callback null, ProjectEditorHandler.buildUserModelView(user, privileges)

	removeUserFromProject: (project_id, user_id, callback)->
		CollaboratorsHandler.removeUserFromProject project_id, user_id, =>
			EditorRealTimeController.emitToRoom(project_id, 'userRemovedFromProject', user_id)
			if callback?
				callback()

	setDoc: (project_id, doc_id, docLines, sl_req_id, callback = (err)->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		DocumentUpdaterHandler.setDocument project_id, doc_id, docLines, (err)=>
			logger.log project_id:project_id, doc_id:doc_id, "notifying users that the document has been updated"
			EditorRealTimeController.emitToRoom(project_id, "entireDocUpdate", doc_id)
			DocumentUpdaterHandler.flushDocToMongo project_id, doc_id, callback

	addDoc: (project_id, folder_id, docName, docLines, sl_req_id, callback = (error, doc)->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		docName = sanitize.escape(docName)
		logger.log sl_req_id:sl_req_id, "sending new doc to project #{project_id}"
		Metrics.inc "editor.add-doc"
		ProjectEntityHandler.addDoc project_id, folder_id, docName, docLines, sl_req_id, (err, doc, folder_id)=>
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewDoc', folder_id, doc)
			callback(err, doc)

	addFile: (project_id, folder_id, fileName, path, sl_req_id, callback = (error, file)->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		fileName = sanitize.escape(fileName)
		logger.log  sl_req_id:sl_req_id, "sending new file to project #{project_id} with folderid: #{folder_id}"
		Metrics.inc "editor.add-file"
		ProjectEntityHandler.addFile project_id, folder_id, fileName, path, (err, fileRef, folder_id)=>
			EditorRealTimeController.emitToRoom(project_id, 'reciveNewFile', folder_id, fileRef)
			callback(err, fileRef)

	replaceFile: (project_id, file_id, fsPath, callback)->
		ProjectEntityHandler.replaceFile project_id, file_id, fsPath, (err) ->
			callback()

	addFolder: (project_id, folder_id, folderName, sl_req_id, callback = (error, folder)->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		folderName = sanitize.escape(folderName)
		logger.log "sending new folder to project #{project_id}"
		Metrics.inc "editor.add-folder"
		ProjectEntityHandler.addFolder project_id, folder_id, folderName, (err, folder, folder_id)=>
			@p.notifyProjectUsersOfNewFolder project_id, folder_id, folder, (error) ->
				callback error, folder

	mkdirp: (project_id, path, callback)->
		logger.log project_id:project_id, path:path, "making directories if they don't exist"
		ProjectEntityHandler.mkdirp project_id, path, (err, newFolders, lastFolder)=>
			self = @
			jobs = _.map newFolders, (folder, index)->
				return (cb)->
					self.p.notifyProjectUsersOfNewFolder project_id, folder.parentFolder_id, folder, cb
			async.series jobs, (err)->
				callback err, newFolders, lastFolder

	deleteEntity: (project_id, entity_id, entityType, sl_req_id, callback)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, entity_id:entity_id, entityType:entityType, "start delete process of entity"
		Metrics.inc "editor.delete-entity"
		ProjectEntityHandler.deleteEntity project_id, entity_id, entityType, =>
			logger.log sl_req_id: sl_req_id, project_id:project_id, entity_id:entity_id, entityType:entityType, "telling users entity has been deleted"
			EditorRealTimeController.emitToRoom(project_id, 'removeEntity', entity_id)
			if callback?
				callback()

	getListOfDocPaths: (project_id, callback)->
		ProjectEntityHandler.getAllDocs project_id, (err, docs)->
			docList = _.map docs, (doc, path)->
				return {_id:doc._id, path:path.substring(1)}
			callback(null, docList)

	forceResyncOfDropbox: (project_id, callback)->
		ProjectEntityHandler.flushProjectToThirdPartyDataStore project_id, callback

	notifyUsersProjectHasBeenDeletedOrRenamed: (project_id, callback)->
		EditorRealTimeController.emitToRoom(project_id, 'projectRenamedOrDeletedByExternalSource')
		callback()

	getLastTimePollHappned: (callback)->
		tpdsPollingBackgroundTasks.getLastTimePollHappned callback

	updateProjectDescription: (project_id, description, callback = ->)->
		logger.log project_id:project_id, description:description, "updating project description"
		ProjectDetailsHandler.setProjectDescription project_id, description, (err)->
			if err?
				logger.err err:err, project_id:project_id, description:description, "something went wrong setting the project description"
				return callback(err)
			EditorRealTimeController.emitToRoom(project_id, 'projectDescriptionUpdated', description)
			callback()

	deleteProject: (project_id, callback)->
		Metrics.inc "editor.delete-project"
		logger.log project_id:project_id, "recived message to delete project"
		ProjectDeleter.deleteProject project_id, callback

	renameEntity: (project_id, entity_id, entityType, newName, callback)->
		newName = sanitize.escape(newName)
		Metrics.inc "editor.rename-entity"
		logger.log entity_id:entity_id, entity_id:entity_id, entity_id:entity_id, "reciving new name for entity for project"
		ProjectEntityHandler.renameEntity project_id, entity_id, entityType, newName, =>
			if newName.length > 0
				EditorRealTimeController.emitToRoom project_id, 'reciveEntityRename', entity_id, newName
				callback?()

	moveEntity: (project_id, entity_id, folder_id, entityType, callback)->
		Metrics.inc "editor.move-entity"
		ProjectEntityHandler.moveEntity project_id, entity_id, folder_id, entityType, =>
			EditorRealTimeController.emitToRoom project_id, 'reciveEntityMove', entity_id, folder_id
			callback?()

	renameProject: (project_id, newName, callback = (err) ->) ->
		newName = sanitize.escape(newName)
		ProjectDetailsHandler.renameProject project_id, newName, =>
			EditorRealTimeController.emitToRoom project_id, 'projectNameUpdated', newName
			callback()

	setCompiler : (project_id, compiler, callback = (err) ->) ->
		ProjectOptionsHandler.setCompiler project_id, compiler, (err) ->
			return callback(err) if err?
			logger.log compiler:compiler, project_id:project_id, "setting compiler"
			EditorRealTimeController.emitToRoom project_id, 'compilerUpdated', compiler
			callback()

	setSpellCheckLanguage : (project_id, languageCode, callback = (err) ->) ->
		ProjectOptionsHandler.setSpellCheckLanguage project_id, languageCode, (err) ->
			return callback(err) if err?
			logger.log languageCode:languageCode, project_id:project_id, "setting languageCode for spell check"
			EditorRealTimeController.emitToRoom project_id, 'spellCheckLanguageUpdated', languageCode
			callback()

	setPublicAccessLevel : (project_id, newAccessLevel, callback = (err) ->) ->
		ProjectDetailsHandler.setPublicAccessLevel project_id, newAccessLevel, (err) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom project_id, 'publicAccessLevelUpdated', newAccessLevel
			callback()

	setRootDoc: (project_id, newRootDocID, callback = (err) ->) ->
		ProjectEntityHandler.setRootDoc project_id, newRootDocID, (err) ->
			return callback(err) if err?
			EditorRealTimeController.emitToRoom project_id, 'rootDocUpdated', newRootDocID
			callback()

			
	p:
		notifyProjectUsersOfNewFolder: (project_id, folder_id, folder, callback = (error)->)->
			logger.log project_id:project_id, folder:folder, parentFolder_id:folder_id, "sending newly created folder out to users"
			EditorRealTimeController.emitToRoom(project_id, "reciveNewFolder", folder_id, folder)
			callback()

