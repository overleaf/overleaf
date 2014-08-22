Project = require('../../models/Project').Project
Doc = require('../../models/Doc').Doc
Folder = require('../../models/Folder').Folder
File = require('../../models/File').File
FileStoreHandler = require("../FileStore/FileStoreHandler")
Errors = require "../../errors"
tpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
projectLocator = require('./ProjectLocator')
path = require "path"
async = require "async"
_ = require('underscore')
logger = require('logger-sharelatex')
slReqIdHelper = require('soa-req-id')
docComparitor = require('./DocLinesComparitor')
projectUpdateHandler = require('./ProjectUpdateHandler')
DocstoreManager = require "../Docstore/DocstoreManager"
ProjectGetter = require "./ProjectGetter"

module.exports = ProjectEntityHandler =
	getAllFolders: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log sl_req_id: sl_req_id, project_id:project_id, "getting all folders for project" 
		folders = {}
		processFolder = (basePath, folder) ->
			folders[basePath] = folder
			processFolder path.join(basePath, childFolder.name), childFolder for childFolder in folder.folders

		ProjectGetter.getProjectWithoutDocLines project_id, (err, project) ->
			return callback(err) if err?
			return callback("no project") if !project?
			processFolder "/", project.rootFolder[0]
			callback null, folders

	getAllDocs: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, "getting all docs for project"

		# We get the path and name info from the project, and the lines and
		# version info from the doc store.
		DocstoreManager.getAllDocs project_id, (error, docContentsArray) ->
			return callback(error) if error?

			# Turn array from docstore into a dictionary based on doc id
			docContents = {}
			for docContent in docContentsArray
				docContents[docContent._id] = docContent

			ProjectEntityHandler.getAllFolders project_id, sl_req_id, (error, folders) ->
				return callback(error) if error?
				docs = {}
				for folderPath, folder of folders
					for doc in folder.docs
						content = docContents[doc._id.toString()]
						docs[path.join(folderPath, doc.name)] = {
							_id:   doc._id
							name:  doc.name
							lines: content.lines
							rev:   content.rev
						}
				logger.log count:_.keys(docs).length, project_id:project_id, "returning docs for project"
				callback null, docs

	getAllFiles: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, "getting all files for project"
		@getAllFolders project_id, sl_req_id, (err, folders) ->
			return callback(err) if err?
			files = {}
			for folderPath, folder of folders
				for file in folder.fileRefs
					files[path.join(folderPath, file.name)] = file
			callback null, files

	flushProjectToThirdPartyDataStore: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		self = @
		logger.log sl_req_id: sl_req_id, project_id:project_id, "flushing project to tpds"
		documentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
		documentUpdaterHandler.flushProjectToMongo project_id, undefined, (error) ->
			return callback(error) if error?
			Project.findById project_id, (error, project) ->
				return callback(error) if error?
				requests = []
				self.getAllDocs project_id, (error, docs) ->
					return callback(error) if error?
					for docPath, doc of docs
						do (docPath, doc) ->
							requests.push (callback) ->
								tpdsUpdateSender.addDoc {project_id:project_id, doc_id:doc._id, path:docPath, project_name:project.name, rev:doc.rev||0},
									sl_req_id,
									callback
					self.getAllFiles project_id, (error, files) ->
						return callback(error) if error?
						for filePath, file of files
							do (filePath, file) ->
								requests.push (callback) ->
									tpdsUpdateSender.addFile {project_id:project_id, file_id:file._id, path:filePath, project_name:project.name, rev:file.rev},
										sl_req_id,
										callback
						async.series requests, (err) ->
							logger.log sl_req_id: sl_req_id, project_id:project_id, "finished flushing project to tpds"
							callback(err)

	setRootDoc: (project_id, newRootDocID, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log sl_req_id: sl_req_id, project_id: project_id, rootDocId: newRootDocID, "setting root doc"
		Project.update {_id:project_id}, {rootDoc_id:newRootDocID}, {}, callback
	
	unsetRootDoc: (project_id, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log sl_req_id: sl_req_id, project_id: project_id, "removing root doc"
		Project.update {_id:project_id}, {$unset: {rootDoc_id: true}}, {}, callback

	getDoc: (project_id, doc_id, options = {}, callback = (error, lines, rev) ->) ->
		if typeof(options) == "function"
			callback = options
			options = {}
		DocstoreManager.getDoc project_id, doc_id, options, callback

	addDoc: (project_or_id, folder_id, docName, docLines, sl_req_id, callback = (error, doc, folder_id) ->)=>
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		Project.getProject project_or_id, "", (err, project) ->
			logger.log sl_req_id: sl_req_id, project: project._id, folder_id: folder_id, doc_name: docName, "adding doc"
			return callback(err) if err?
			confirmFolder project, folder_id, (folder_id)=>
				doc = new Doc name: docName
				Project.putElement project._id, folder_id, doc, "doc", (err, result)=>
					return callback(err) if err?
					DocstoreManager.updateDoc project._id.toString(), doc._id.toString(), docLines, (err, modified, rev) ->
						return callback(err) if err? 
						tpdsUpdateSender.addDoc {
							project_id:   project._id,
							doc_id:		  doc._id	
							path:         result.path.fileSystem,
							project_name: project.name,
							rev:          0
						}, sl_req_id, (err) ->
							return callback(err) if err?
							callback(null, doc, folder_id)

	restoreDoc: (project_id, doc_id, name, callback = (error, doc, folder_id) ->) ->
		# getDoc will return the deleted doc's lines, but we don't actually remove
		# the deleted doc, just create a new one from its lines.
		ProjectEntityHandler.getDoc project_id, doc_id, include_deleted: true, (error, lines) ->
			return callback(error) if error?
			ProjectEntityHandler.addDoc project_id, null, name, lines, callback

	addFile: (project_or_id, folder_id, fileName, path, sl_req_id, callback = (error, fileRef, folder_id) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		Project.getProject project_or_id, "", (err, project) ->
			logger.log sl_req_id: sl_req_id, project_id: project._id, folder_id: folder_id, file_name: fileName, path:path, "adding file"
			return callback(err) if err?
			confirmFolder project, folder_id, (folder_id)->
				fileRef = new File name : fileName
				FileStoreHandler.uploadFileFromDisk project._id, fileRef._id, path, (err)->
					if err?
						logger.err err:err, project_id: project._id, folder_id: folder_id, file_name: fileName, fileRef:fileRef, "error uploading image to s3"
						return callback(err)
					Project.putElement project._id, folder_id, fileRef, "file", (err, result)=>
						tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:result.path.fileSystem, project_name:project.name, rev:fileRef.rev}, "sl_req_id_here", ->
							callback(err, fileRef, folder_id)

	replaceFile: (project_or_id, file_id, fsPath, callback)->
		Project.getProject project_or_id, "", (err, project) ->
			return callback(err) if err?
			findOpts = 
				project_id:project._id
				element_id:file_id
				type:"file"
			FileStoreHandler.uploadFileFromDisk project._id, file_id, fsPath, (err)->
				return callback(err) if err?
				# Note there is a potential race condition here (and elsewhere)
				# If the file tree changes between findElement and the Project.update
				# then the path to the file element will be out of date. In practice
				# this is not a problem so long as we do not do anything longer running
				# between them (like waiting for the file to upload.)
				projectLocator.findElement findOpts, (err, fileRef, path)=>
					return callback(err) if err?
					tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:path.fileSystem, rev:fileRef.rev+1, project_name:project.name}, "sl_req_id_here", (error) ->
						return callback(err) if err?
						conditons = _id:project._id
						inc = {}
						inc["#{path.mongo}.rev"] = 1
						set = {}
						set["#{path.mongo}.created"] = new Date()
						update =
							"$inc": inc
							"$set": set
						Project.update conditons, update, {}, (err, second)->
							callback()

	copyFileFromExistingProject: (project_or_id, folder_id, originalProject_id, origonalFileRef, sl_req_id, callback = (error, fileRef, folder_id) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		Project.getProject project_or_id, "", (err, project) ->
			logger.log sl_req_id: sl_req_id, project_id:project._id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "copying file in s3"
			return callback(err) if err?
			confirmFolder project, folder_id, (folder_id)=>
				fileRef = new File name : origonalFileRef.name
				FileStoreHandler.copyFile originalProject_id, origonalFileRef._id, project._id, fileRef._id, (err)->
					if err?
						logger.err err:err, project_id:project._id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "error coping file in s3"
					Project.putElement project._id, folder_id, fileRef, "file", (err, result)=>
						tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:result.path.fileSystem, rev:fileRef.rev, project_name:project.name}, sl_req_id, (error) ->
							callback(error, fileRef, folder_id)

	mkdirp: (project_or_id, path, sl_req_id, callback = (err, newlyCreatedFolders, lastFolderInPath)->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		self = @
		folders = path.split('/')
		folders = _.select folders, (folder)->
			return folder.length != 0

		Project.getProject project_or_id, "", (err, project)=>
			if path == '/'
				logger.log project_id: project._id, "mkdir is only trying to make path of / so sending back root folder"
				return callback(null, [], project.rootFolder[0])
			logger.log project_id: project._id, path:path, folders:folders, "running mkdirp"

			builtUpPath = ''
			procesFolder = (previousFolders, folderName, callback)=>
				previousFolders = previousFolders || []
				parentFolder = previousFolders[previousFolders.length-1]
				if parentFolder?  
					parentFolder_id = parentFolder._id
				builtUpPath = "#{builtUpPath}/#{folderName}"
				projectLocator.findElementByPath project_or_id, builtUpPath, (err, foundFolder)=>
					if !foundFolder?
						logger.log sl_req_id: sl_req_id, path:path, project_id:project._id, folderName:folderName, "making folder from mkdirp"
						@addFolder project_or_id, parentFolder_id, folderName, sl_req_id, (err, newFolder, parentFolder_id)->
							newFolder.parentFolder_id = parentFolder_id
							previousFolders.push newFolder
							callback null, previousFolders
					else
						foundFolder.filterOut = true
						previousFolders.push foundFolder
						callback  null, previousFolders


			async.reduce folders, [], procesFolder, (err, folders)->
				lastFolder = folders[folders.length-1]
				folders = _.select folders, (folder)->
					!folder.filterOut
				callback(null, folders, lastFolder)
	
	addFolder: (project_or_id, parentFolder_id, folderName, sl_req_id, callback)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		folder = new Folder name: folderName
		Project.getProject project_or_id, "", (err, project) ->
			return callback(err) if err?
			confirmFolder project, parentFolder_id, (parentFolder_id)=>
				logger.log sl_req_id: sl_req_id, project: project_or_id, parentFolder_id:parentFolder_id, folderName:folderName, "new folder added"
				Project.putElement project._id, parentFolder_id, folder, "folder", (err, result)=>
					if callback?
						callback(err, folder, parentFolder_id)

	updateDocLines : (project_id, doc_id, lines, callback = (error) ->)->
		ProjectGetter.getProjectWithoutDocLines project_id, (err, project)->
			return callback(err) if err?
			return callback(new Errors.NotFoundError("project not found")) if !project?
			logger.log project_id: project_id, doc_id: doc_id, "updating doc lines"
			projectLocator.findElement {project:project, element_id:doc_id, type:"docs"}, (err, doc, path)->
				if err?
					logger.error err: err, doc_id: doc_id, project_id: project_id, lines: lines, "error finding doc while updating doc lines"
					return callback err
				if !doc?
					error = new Errors.NotFoundError("doc not found")
					logger.error err: error, doc_id: doc_id, project_id: project_id, lines: lines, "doc not found while updating doc lines"
					return callback(error)

				DocstoreManager.updateDoc project_id, doc_id, lines, (err, modified, rev) ->
					if err?
						logger.error err: err, doc_id: doc_id, project_id:project_id, lines: lines, "error sending doc to docstore"
						return callback(err)

					if modified
						# Don't need to block for marking as updated
						projectUpdateHandler.markAsUpdated project_id
						tpdsUpdateSender.addDoc {project_id:project_id, path:path.fileSystem, doc_id:doc_id, project_name:project.name, rev:rev}, callback
					else
						callback()

	moveEntity: (project_id, entity_id, folder_id, entityType, callback = (error) ->)->
		self = @
		destinationFolder_id = folder_id
		logger.log entityType:entityType, entity_id:entity_id, project_id:project_id, folder_id:folder_id, "moving entity"
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		Project.findById project_id, (err, project)=>
			return callback(err) if err?
			projectLocator.findElement {project:project, element_id:entity_id, type:entityType}, (err, entity, path)->
				return callback(err) if err?
				
				if entityType.match(/folder/)
					ensureFolderIsNotMovedIntoChild = (callback = (error) ->) ->
						projectLocator.findElement {project: project, element_id: folder_id, type:"folder"}, (err, destEntity, destPath) ->
							logger.log destPath: destPath.fileSystem, folderPath: path.fileSystem, "checking folder is not moving into child folder"
							if (destPath.fileSystem.slice(0, path.fileSystem.length) == path.fileSystem)
								logger.log "destination is a child folder, aborting"
								callback(new Error("destination folder is a child folder of me"))
							else
								callback()
				else
					ensureFolderIsNotMovedIntoChild = (callback = () ->) -> callback()
					
				ensureFolderIsNotMovedIntoChild (error) ->
					return callback(error) if error?
					self._removeElementFromMongoArray Project, project_id, path.mongo, (err)->
						return callback(err) if err?
						Project.putElement project_id, destinationFolder_id, entity, entityType, (err, result)->
							return callback(err) if err?
							opts = 
								project_id:project_id
								project_name:project.name
								startPath:path.fileSystem
								endPath:result.path.fileSystem,
								rev:entity.rev
							tpdsUpdateSender.moveEntity opts, callback

	deleteEntity: (project_id, entity_id, entityType, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		self = @
		logger.log entity_id:entity_id, type:entityType, project_id:project_id, "deleting project entity"
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		Project.findById project_id, (err, project)=>
			return callback(error) if error?
			projectLocator.findElement {project: project, element_id: entity_id, type: entityType}, (error, entity, path)=>
				return callback(error) if error?
				ProjectEntityHandler._cleanUpEntity project, entity, entityType, (error) ->
					return callback(error) if error?
					tpdsUpdateSender.deleteEntity project_id:project_id, path:path.fileSystem, project_name:project.name, sl_req_id, (error) ->
						return callback(error) if error?
						self._removeElementFromMongoArray Project, project_id, path.mongo, (error) ->
							return callback(error) if error?
							callback null


	renameEntity: (project_id, entity_id, entityType, newName, callback)->
		logger.log(entity_id: entity_id, project_id: project_id, ('renaming '+entityType))
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		Project.findById project_id, (err, project)=>
			projectLocator.findElement {project:project, element_id:entity_id, type:entityType}, (err, entity, path, folder)=>
				if err?
					return callback err
				conditons = {_id:project_id}
				update = "$set":{}
				namePath = path.mongo+".name"
				update["$set"][namePath] = newName
				endPath = path.fileSystem.replace(entity.name, newName)
				tpdsUpdateSender.moveEntity({project_id:project_id, startPath:path.fileSystem, endPath:endPath, project_name:project.name, rev:entity.rev})
				Project.update conditons, update, {}, (err)->
					if callback?
						callback err

	_cleanUpEntity: (project, entity, entityType, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)

		if(entityType.indexOf("file") != -1)
			ProjectEntityHandler._cleanUpFile project, entity, sl_req_id, callback
		else if (entityType.indexOf("doc") != -1)
			ProjectEntityHandler._cleanUpDoc project, entity, sl_req_id, callback
		else if (entityType.indexOf("folder") != -1)
			ProjectEntityHandler._cleanUpFolder project, entity, sl_req_id, callback
		else
			callback()

	_cleanUpDoc: (project, doc, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		project_id = project._id.toString()
		doc_id = doc._id.toString()
		unsetRootDocIfRequired = (callback) =>
			if project.rootDoc_id? and project.rootDoc_id.toString() == doc_id
				@unsetRootDoc project_id, callback
			else
				callback()

		unsetRootDocIfRequired (error) ->
			return callback(error) if error?
			require('../../Features/DocumentUpdater/DocumentUpdaterHandler').deleteDoc project_id, doc_id, (error) ->
				return callback(error) if error?
				ProjectEntityHandler._insertDeletedDocReference project._id, doc, (error) ->
					return callback(error) if error?
					DocstoreManager.deleteDoc project_id, doc_id, (error) ->
						return callback(error) if error?
						callback()

	_cleanUpFile: (project, file, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		project_id = project._id.toString()
		file_id = file._id.toString()
		FileStoreHandler.deleteFile project_id, file_id, callback

	_cleanUpFolder: (project, folder, sl_req_id, callback = (error) ->) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)

		jobs = []
		for doc in folder.docs
			do (doc) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpDoc project, doc, sl_req_id, callback

		for file in folder.fileRefs
			do (file) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpFile project, file, sl_req_id, callback

		for childFolder in folder.folders
			do (childFolder) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpFolder project, childFolder, sl_req_id, callback

		async.series jobs, callback

	_removeElementFromMongoArray : (model, model_id, path, callback)->
		conditons = {_id:model_id}
		update = {"$unset":{}}
		update["$unset"][path] = 1
		model.update conditons, update, {}, (err)->
			pullUpdate = {"$pull":{}}
			nonArrayPath = path.slice(0, path.lastIndexOf("."))
			pullUpdate["$pull"][nonArrayPath] = null
			model.update conditons, pullUpdate, {}, (err)->
				if callback?
					callback(err)

	_insertDeletedDocReference: (project_id, doc, callback = (error) ->) ->
		Project.update {
			_id: project_id
		}, {
			$push: {
				deletedDocs: {
					_id:  doc._id
					name: doc.name
				}
			}
		}, {}, callback

confirmFolder = (project, folder_id, callback)->
	logger.log folder_id:folder_id, project_id:project._id, "confirming folder in project"
	if folder_id+'' == 'undefined'
		callback(project.rootFolder[0]._id)
	else if folder_id != null
		callback folder_id
	else
		callback(project.rootFolder[0]._id)
