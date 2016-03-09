Project = require('../../models/Project').Project
settings = require "settings-sharelatex"
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
docComparitor = require('./DocLinesComparitor')
projectUpdateHandler = require('./ProjectUpdateHandler')
DocstoreManager = require "../Docstore/DocstoreManager"
ProjectGetter = require "./ProjectGetter"

module.exports = ProjectEntityHandler =
	getAllFolders: (project_id,  callback) ->
		logger.log project_id:project_id, "getting all folders for project" 
		folders = {}
		processFolder = (basePath, folder) ->
			folders[basePath] = folder
			processFolder path.join(basePath, childFolder.name), childFolder for childFolder in folder.folders

		ProjectGetter.getProjectWithoutDocLines project_id, (err, project) ->
			return callback(err) if err?
			return callback("no project") if !project?
			processFolder "/", project.rootFolder[0]
			callback null, folders

	getAllDocs: (project_id, callback) ->
		logger.log project_id:project_id, "getting all docs for project"

		# We get the path and name info from the project, and the lines and
		# version info from the doc store.
		DocstoreManager.getAllDocs project_id, (error, docContentsArray) ->
			return callback(error) if error?

			# Turn array from docstore into a dictionary based on doc id
			docContents = {}
			for docContent in docContentsArray
				docContents[docContent._id] = docContent

			ProjectEntityHandler.getAllFolders project_id, (error, folders) ->
				return callback(error) if error?
				docs = {}
				for folderPath, folder of folders
					for doc in folder.docs
						content = docContents[doc._id.toString()]
						if content?
							docs[path.join(folderPath, doc.name)] = {
								_id:   doc._id
								name:  doc.name
								lines: content.lines
								rev:   content.rev
							}
				logger.log count:_.keys(docs).length, project_id:project_id, "returning docs for project"
				callback null, docs

	getAllFiles: (project_id, callback) ->
		logger.log project_id:project_id, "getting all files for project"
		@getAllFolders project_id, (err, folders) ->
			return callback(err) if err?
			files = {}
			for folderPath, folder of folders
				for file in folder.fileRefs
					if file?
						files[path.join(folderPath, file.name)] = file
			callback null, files

	flushProjectToThirdPartyDataStore: (project_id, callback) ->
		self = @
		logger.log project_id:project_id, "flushing project to tpds"
		documentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
		documentUpdaterHandler.flushProjectToMongo project_id, (error) ->
			return callback(error) if error?
			ProjectGetter.getProject project_id, {name:true}, (error, project) ->
				return callback(error) if error?
				requests = []
				self.getAllDocs project_id, (error, docs) ->
					return callback(error) if error?
					for docPath, doc of docs
						do (docPath, doc) ->
							requests.push (cb) ->
								tpdsUpdateSender.addDoc {project_id:project_id, doc_id:doc._id, path:docPath, project_name:project.name, rev:doc.rev||0}, cb
					self.getAllFiles project_id, (error, files) ->
						return callback(error) if error?
						for filePath, file of files
							do (filePath, file) ->
								requests.push (cb) ->
									tpdsUpdateSender.addFile {project_id:project_id, file_id:file._id, path:filePath, project_name:project.name, rev:file.rev}, cb
						async.series requests, (err) ->
							logger.log project_id:project_id, "finished flushing project to tpds"
							callback(err)

	setRootDoc: (project_id, newRootDocID, callback = (error) ->)->
		logger.log project_id: project_id, rootDocId: newRootDocID, "setting root doc"
		Project.update {_id:project_id}, {rootDoc_id:newRootDocID}, {}, callback
	
	unsetRootDoc: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "removing root doc"
		Project.update {_id:project_id}, {$unset: {rootDoc_id: true}}, {}, callback

	getDoc: (project_id, doc_id, options = {}, callback = (error, lines, rev) ->) ->
		if typeof(options) == "function"
			callback = options
			options = {}
		DocstoreManager.getDoc project_id, doc_id, options, callback


	addDoc: (project_id, folder_id, docName, docLines, callback = (error, doc, folder_id) ->)=>
		ProjectGetter.getProjectWithOnlyFolders project_id, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add doc"
				return callback(err)
			ProjectEntityHandler.addDocWithProject project, folder_id, docName, docLines, callback

	addDocWithProject: (project, folder_id, docName, docLines, callback = (error, doc, folder_id) ->)=>
		project_id = project._id
		logger.log project_id: project_id, folder_id: folder_id, doc_name: docName, "adding doc to project with project"
		confirmFolder project, folder_id, (folder_id)=>
			doc = new Doc name: docName
			# Put doc in docstore first, so that if it errors, we don't have a doc_id in the project
			# which hasn't been created in docstore.
			DocstoreManager.updateDoc project_id.toString(), doc._id.toString(), docLines, (err, modified, rev) ->
				return callback(err) if err? 

				ProjectEntityHandler._putElement project, folder_id, doc, "doc", (err, result)=>
					return callback(err) if err?
					tpdsUpdateSender.addDoc {
						project_id:   project_id,
						doc_id:		  doc?._id
						path:         result?.path?.fileSystem,
						project_name: project.name,
						rev:          0
					}, (err) ->
						if err?
							logger.err err:err, "error adding doc to tpdsworker, contining anyway"
						callback(null, doc, folder_id)

	restoreDoc: (project_id, doc_id, name, callback = (error, doc, folder_id) ->) ->
		# getDoc will return the deleted doc's lines, but we don't actually remove
		# the deleted doc, just create a new one from its lines.
		ProjectEntityHandler.getDoc project_id, doc_id, include_deleted: true, (error, lines) ->
			return callback(error) if error?
			ProjectEntityHandler.addDoc project_id, null, name, lines, callback

	addFile: (project_id, folder_id, fileName, path, callback = (error, fileRef, folder_id) ->)->
		ProjectGetter.getProjectWithOnlyFolders project_id, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add file"
				return callback(err)
			ProjectEntityHandler.addFileWithProject project, folder_id, fileName, path, callback

	addFileWithProject: (project, folder_id, fileName, path, callback = (error, fileRef, folder_id) ->)->
		project_id = project._id
		logger.log project_id: project._id, folder_id: folder_id, file_name: fileName, path:path, "adding file"
		return callback(err) if err?
		confirmFolder project, folder_id, (folder_id)->
			fileRef = new File name : fileName
			FileStoreHandler.uploadFileFromDisk project._id, fileRef._id, path, (err)->
				if err?
					logger.err err:err, project_id: project._id, folder_id: folder_id, file_name: fileName, fileRef:fileRef, "error uploading image to s3"
					return callback(err)
				ProjectEntityHandler._putElement project, folder_id, fileRef, "file", (err, result)=>
					tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:result.path.fileSystem, project_name:project.name, rev:fileRef.rev}, ->
						callback(err, fileRef, folder_id)

	replaceFile: (project_id, file_id, fsPath, callback)->
		ProjectGetter.getProject project_id, {name:true}, (err, project) ->
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
					tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:path.fileSystem, rev:fileRef.rev+1, project_name:project.name}, (error) ->
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

	copyFileFromExistingProject: (project_id, folder_id, originalProject_id, origonalFileRef, callback = (error, fileRef, folder_id) ->)->
		logger.log project_id:project_id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "copying file in s3"
		ProjectGetter.getProject project_id, {name:true}, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for copy file from existing project"
				return callback(err)
			ProjectEntityHandler.copyFileFromExistingProjectWithProject project, folder_id, originalProject_id, origonalFileRef, callback


	copyFileFromExistingProjectWithProject: (project, folder_id, originalProject_id, origonalFileRef, callback = (error, fileRef, folder_id) ->)->
		project_id = project._id
		logger.log project_id:project_id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "copying file in s3 with project"
		return callback(err) if err?
		confirmFolder project, folder_id, (folder_id)=>
			if !origonalFileRef?
				logger.err project_id:project._id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "file trying to copy is null"
				return callback()
			fileRef = new File name : origonalFileRef.name
			FileStoreHandler.copyFile originalProject_id, origonalFileRef._id, project._id, fileRef._id, (err)->
				if err?
					logger.err err:err, project_id:project._id, folder_id:folder_id, originalProject_id:originalProject_id, origonalFileRef:origonalFileRef, "error coping file in s3"
					return callback(err)
				ProjectEntityHandler._putElement project, folder_id, fileRef, "file", (err, result)=>
					if err?
						logger.err err:err, project_id:project._id, folder_id:folder_id, "error putting element as part of copy"
						return callback(err)
					tpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:result?.path?.fileSystem, rev:fileRef.rev, project_name:project.name}, (error) ->
						callback(error, fileRef, folder_id)

	mkdirp: (project_id, path, callback = (err, newlyCreatedFolders, lastFolderInPath)->)->
		self = @
		folders = path.split('/')
		folders = _.select folders, (folder)->
			return folder.length != 0

		ProjectGetter.getProjectWithOnlyFolders project_id, (err, project)=>
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
				projectLocator.findElementByPath project, builtUpPath, (err, foundFolder)=>
					if !foundFolder?
						logger.log path:path, project_id:project._id, folderName:folderName, "making folder from mkdirp"
						@addFolder project_id, parentFolder_id, folderName, (err, newFolder, parentFolder_id)->
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

	addFolder: (project_id, parentFolder_id, folderName, callback) ->
		ProjectGetter.getProjectWithOnlyFolders project_id, (err, project)=>
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add folder"
				return callback(err)
			ProjectEntityHandler.addFolderWithProject project, parentFolder_id, folderName, callback

	addFolderWithProject: (project, parentFolder_id, folderName, callback = (err, folder, parentFolder_id)->) ->
		confirmFolder project, parentFolder_id, (parentFolder_id)=>
			folder = new Folder name: folderName
			logger.log project: project._id, parentFolder_id:parentFolder_id, folderName:folderName, "adding new folder"
			ProjectEntityHandler._putElement project, parentFolder_id, folder, "folder", (err, result)=>
				if err?
					logger.err err:err, project_id:project._id, "error adding folder to project"
					return callback(err)
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

				logger.log project_id: project_id, doc_id: doc_id, "telling docstore manager to update doc"
				DocstoreManager.updateDoc project_id, doc_id, lines, (err, modified, rev) ->
					if err?
						logger.error err: err, doc_id: doc_id, project_id:project_id, lines: lines, "error sending doc to docstore"
						return callback(err)
					logger.log project_id: project_id, doc_id: doc_id, modified:modified, "finished updating doc lines"
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
		ProjectGetter.getProject project_id, {rootFolder:true, name:true}, (err, project)=>
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
						ProjectEntityHandler._putElement project, destinationFolder_id, entity, entityType, (err, result)->
							return callback(err) if err?
							opts = 
								project_id:project_id
								project_name:project.name
								startPath:path.fileSystem
								endPath:result.path.fileSystem,
								rev:entity.rev
							tpdsUpdateSender.moveEntity opts, callback

	deleteEntity: (project_id, entity_id, entityType, callback = (error) ->)->
		self = @
		logger.log entity_id:entity_id, entityType:entityType, project_id:project_id, "deleting project entity"
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		ProjectGetter.getProject project_id, {name:true, rootFolder:true}, (err, project)=>
			return callback(error) if error?
			projectLocator.findElement {project: project, element_id: entity_id, type: entityType}, (error, entity, path)=>
				return callback(error) if error?
				ProjectEntityHandler._cleanUpEntity project, entity, entityType, (error) ->
					return callback(error) if error?
					tpdsUpdateSender.deleteEntity project_id:project_id, path:path.fileSystem, project_name:project.name, (error) ->
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
		ProjectGetter.getProject project_id, {rootFolder:true, name:true}, (err, project)=>
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

	_cleanUpEntity: (project, entity, entityType, callback = (error) ->) ->
		if(entityType.indexOf("file") != -1)
			ProjectEntityHandler._cleanUpFile project, entity, callback
		else if (entityType.indexOf("doc") != -1)
			ProjectEntityHandler._cleanUpDoc project, entity, callback
		else if (entityType.indexOf("folder") != -1)
			ProjectEntityHandler._cleanUpFolder project, entity, callback
		else
			callback()

	_cleanUpDoc: (project, doc, callback = (error) ->) ->
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

	_cleanUpFile: (project, file, callback = (error) ->) ->
		project_id = project._id.toString()
		file_id = file._id.toString()
		FileStoreHandler.deleteFile project_id, file_id, callback

	_cleanUpFolder: (project, folder, callback = (error) ->) ->
		jobs = []
		for doc in folder.docs
			do (doc) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpDoc project, doc, callback

		for file in folder.fileRefs
			do (file) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpFile project, file, callback

		for childFolder in folder.folders
			do (childFolder) ->
				jobs.push (callback) -> ProjectEntityHandler._cleanUpFolder project, childFolder, callback

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


	_countElements : (project, callback)->
	
		countFolder = (folder, cb = (err, count)->)->

			jobs = _.map folder?.folders, (folder)->
				(asyncCb)-> countFolder folder, asyncCb

			async.series jobs, (err, subfolderCounts)->
				total = 0

				if subfolderCounts?.length > 0
					total = _.reduce subfolderCounts, (a, b)-> return a + b
				if folder?.folders?.length?
					total += folder?.folders?.length
				if folder?.docs?.length?
					total += folder?.docs?.length
				if folder?.fileRefs?.length?
					total += folder?.fileRefs?.length
				cb(null, total)

		countFolder project.rootFolder[0], callback

	_putElement: (project, folder_id, element, type, callback = (err, path)->)->

		sanitizeTypeOfElement = (elementType)->
			lastChar = elementType.slice -1
			if lastChar != "s"
				elementType +="s"
			if elementType == "files"
				elementType = "fileRefs"
			return elementType

		if !element?
			e = new Error("no element passed to be inserted")
			logger.err project_id:project._id, folder_id:folder_id, element:element, type:type, "failed trying to insert element as it was null"
			return callback(e)
		type = sanitizeTypeOfElement type

		if !folder_id?
			folder_id = project.rootFolder[0]._id
		ProjectEntityHandler._countElements project, (err, count)->
			if count > settings.maxEntitiesPerProject
				logger.warn project_id:project._id, "project too big, stopping insertions"
				return callback("project_has_to_many_files")
			projectLocator.findElement {project:project, element_id:folder_id, type:"folders"}, (err, folder, path)=>
				if err?
					logger.err err:err, project_id:project._id, folder_id:folder_id, type:type, element:element, "error finding folder for _putElement"
					return callback(err)
				newPath =
					fileSystem: "#{path.fileSystem}/#{element.name}"
					mongo: path.mongo
				logger.log project_id: project._id, element_id: element._id, fileType: type, folder_id: folder_id, "adding element to project"
				id = element._id+''
				element._id = require('mongoose').Types.ObjectId(id)
				conditions = _id:project._id
				mongopath = "#{path.mongo}.#{type}"
				update = "$push":{}
				update["$push"][mongopath] = element
				Project.update conditions, update, {}, (err)->
					if err?
						logger.err err: err, project_id: project._id, 'error saving in putElement project'
						return callback(err)
					callback(err, {path:newPath})


confirmFolder = (project, folder_id, callback)->
	logger.log folder_id:folder_id, project_id:project._id, "confirming folder in project"
	if folder_id+'' == 'undefined'
		callback(project.rootFolder[0]._id)
	else if folder_id != null
		callback folder_id
	else
		callback(project.rootFolder[0]._id)
