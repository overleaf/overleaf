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

module.exports = ProjectEntityHandler =
	getAllFolders: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log sl_req_id: sl_req_id, project_id:project_id, "getting all folders for project" 
		folders = {}
		processFolder = (basePath, folder) ->
			folders[basePath] = folder
			processFolder path.join(basePath, childFolder.name), childFolder for childFolder in folder.folders

		Project.findById project_id, (err, project) ->
			return callback(err) if err?
			return callback("no project") if !project?
			processFolder "/", project.rootFolder[0]
			callback null, folders

	getAllDocs: (project_id, sl_req_id, callback) ->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		logger.log project_id:project_id, "getting all docs for project"
		@getAllFolders project_id, sl_req_id, (err, folders) ->
			return callback(err) if err?
			docs = {}
			for folderPath, folder of folders
				for doc in folder.docs
					docs[path.join(folderPath, doc.name)] = doc
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
			Project.findById project_id, (err, project) ->
				return callback(error) if error?
				requests = []
				self.getAllDocs project_id, (err, docs) ->
					for docPath, doc of docs
						do (docPath, doc) ->
							requests.push (callback) ->
								tpdsUpdateSender.addDoc {project_id:project_id, docLines:doc.lines, path:docPath, project_name:project.name, rev:doc.rev||0},
									sl_req_id,
									callback
					self.getAllFiles project_id, (err, files) ->
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

	addDoc: (project_or_id, folder_id, docName, docLines, sl_req_id, callback = (error, doc, folder_id) ->)=>
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		Project.getProject project_or_id, "", (err, project) ->
			logger.log sl_req_id: sl_req_id, project: project._id, folder_id: folder_id, doc_name: docName, "adding doc"
			return callback(err) if err?
			confirmFolder project, folder_id, (folder_id)=>
				doc = new Doc name: docName, lines: docLines
				Project.putElement project._id, folder_id, doc, "doc", (err, result)=>
					tpdsUpdateSender.addDoc {project_id:project._id, docLines:docLines, path:result.path.fileSystem, project_name:project.name, rev:doc.rev}, sl_req_id, ->
						callback(err, doc, folder_id)

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
			findOpts = 
				project_id:project._id
				element_id:file_id
				type:"file"
			projectLocator.findElement findOpts, (err, fileRef, path)=>
				FileStoreHandler.uploadFileFromDisk project._id, fileRef._id, fsPath, (err)->
					tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:path.fileSystem, rev:fileRef.rev+1, project_name:project.name}, "sl_req_id_here", (error) ->
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

	updateDocLines : (project_or_id, doc_id, docLines, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		Project.getProject project_or_id, "", (err, project)->
			return callback(err) if err?
			return callback(new Errors.NotFoundError("project not found")) if !project?
			project_id = project._id
			if err?
				logger.err err:err,project_id:project_id, "error finding project"
				callback err
			else if !project?
				logger.err project_id:project_id, doc_id:doc_id, err: new Error("project #{project_id} could not be found for doc #{doc_id}")
				callback "could not find project #{project_id}"
			else
				projectLocator.findElement {project:project, element_id:doc_id, type:"docs"}, (err, doc, path)->
					if err?
						logger.err "error putting doc #{doc_id} in project #{project_id} #{err}"
						callback err
					else if docComparitor.areSame docLines, doc.lines
						logger.log sl_req_id: sl_req_id, project_id:project_id, doc_id:doc_id, rev:doc.rev, "old doc lines are same as the new doc lines, not updating them"
						callback()
					else
						logger.log sl_req_id: sl_req_id, project_id:project_id, doc_id:doc_id, docLines: docLines, oldDocLines: doc.lines, rev:doc.rev, "updating doc lines"
						conditons = _id:project_id
						update = {$set:{}, $inc:{}}
						changeLines = {}
						changeLines["#{path.mongo}.lines"] = docLines
						inc = {}
						inc["#{path.mongo}.rev"] = 1
						update["$set"] = changeLines
						update["$inc"] = inc
						Project.update conditons, update, {}, (err, second)->
							if(err)
								logger.err(sl_req_id:sl_req_id, doc_id:doc_id, project_id:project_id, err:err, "error saving doc to mongo")
								callback(err)
							else
								logger.log sl_req_id:sl_req_id, doc_id:doc_id, project_id:project_id, newDocLines:docLines, oldDocLines:doc.lines,	 "doc saved to mongo"
								rev = doc.rev+1
								projectUpdateHandler.markAsUpdated project_id
							tpdsUpdateSender.addDoc {project_id:project_id, path:path.fileSystem, docLines:docLines, project_name:project.name, rev:rev}, sl_req_id, callback

	moveEntity: (project_id, entity_id, folder_id, entityType, sl_req_id, callback = (error) ->)->
		{callback, sl_req_id} = slReqIdHelper.getCallbackAndReqId(callback, sl_req_id)
		self = @
		destinationFolder_id = folder_id
		logger.log sl_req_id: sl_req_id, entityType:entityType, entity_id:entity_id, project_id:project_id, folder_id:folder_id, "moving entity"
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		Project.findById project_id, (err, project)=>
			projectLocator.findElement {project:project, element_id:entity_id, type:entityType}, (err, entity, path)->
				return callback(err) if err?
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
						tpdsUpdateSender.moveEntity opts, sl_req_id, callback

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
			require('../../Features/DocumentUpdater/DocumentUpdaterHandler').deleteDoc project_id, doc_id, callback

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

confirmFolder = (project, folder_id, callback)->
	logger.log folder_id:folder_id, project_id:project._id, "confirming folder in project"
	if folder_id+'' == 'undefined'
		callback(project.rootFolder[0]._id)
	else if folder_id != null
		callback folder_id
	else
		callback(project.rootFolder[0]._id)
