_ = require('underscore')
async = require 'async'
logger = require('logger-sharelatex')
path = require('path')
settings = require('settings-sharelatex')
CooldownManager = require '../Cooldown/CooldownManager'
Errors = require '../Errors/Errors'
Folder = require('../../models/Folder').Folder
LockManager = require('../../infrastructure/LockManager')
Project = require('../../models/Project').Project
ProjectEntityHandler = require('./ProjectEntityHandler')
ProjectGetter = require('./ProjectGetter')
ProjectLocator = require('./ProjectLocator')
SafePath = require './SafePath'

LOCK_NAMESPACE = "mongoTransaction"

wrapWithLock = (methodWithoutLock) ->
	# This lock is used whenever we read or write to an existing project's
	# structure. Some operations to project structure cannot be done atomically
	# in mongo, this lock is used to prevent reading the structure between two
	# parts of a staged update.
	methodWithLock = (project_id, args..., callback) ->
		LockManager.runWithLock LOCK_NAMESPACE, project_id,
			(cb) -> methodWithoutLock project_id, args..., cb
			callback
	methodWithLock.withoutLock = methodWithoutLock
	methodWithLock

module.exports = ProjectEntityMongoUpdateHandler = self =
	LOCK_NAMESPACE: LOCK_NAMESPACE

	addDoc: wrapWithLock (project_id, folder_id, doc, callback = (err, result) ->) ->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add doc"
				return callback(err)
			logger.log project_id: project_id, folder_id: folder_id, doc_name: doc.name, "adding doc to project with project"
			self._confirmFolder project, folder_id, (folder_id) =>
				self._putElement project, folder_id, doc, "doc", callback

	addFile: wrapWithLock (project_id, folder_id, fileRef, callback = (error, result, project) ->)->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add file"
				return callback(err)
			logger.log project_id: project._id, folder_id: folder_id, file_name: fileRef.name, "adding file"
			self._confirmFolder project, folder_id, (folder_id)->
				self._putElement project, folder_id, fileRef, "file", callback

	replaceFileWithNew: wrapWithLock (project_id, file_id, newFileRef, callback) ->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (err, project) ->
			return callback(err) if err?
			ProjectLocator.findElement {project:project, element_id: file_id, type: 'file'}, (err, fileRef, path)=>
				return callback(err) if err?
				ProjectEntityMongoUpdateHandler._insertDeletedFileReference project_id, fileRef, (err) ->
					return callback(err) if err?
					conditions = _id:project._id
					inc = {}
					# increment the project structure version as we are adding a new file here
					inc['version'] = 1
					set = {}
					set["#{path.mongo}._id"] = newFileRef._id
					set["#{path.mongo}.created"] = new Date()
					set["#{path.mongo}.linkedFileData"] = newFileRef.linkedFileData
					inc["#{path.mongo}.rev"] = 1
					update =
						"$inc": inc
						"$set": set
					# Note: Mongoose uses new:true to return the modified document
					# https://mongoosejs.com/docs/api.html#model_Model.findOneAndUpdate
					# but Mongo uses returnNewDocument:true instead
					# https://docs.mongodb.com/manual/reference/method/db.collection.findOneAndUpdate/
					# We are using Mongoose here, but if we ever switch to a direct mongo call
					# the next line will need to be updated.
					Project.findOneAndUpdate conditions, update, {new:true}, (err, newProject) ->
						return callback(err) if err?
						callback null, fileRef, project, path, newProject

	mkdirp: wrapWithLock (project_id, path, options, callback) ->
		# defaults to case insensitive paths, use options {exactCaseMatch:true}
		# to make matching case-sensitive
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
				ProjectLocator.findElementByPath project: project, path: builtUpPath, exactCaseMatch: options?.exactCaseMatch, (err, foundFolder)=>
					if !foundFolder?
						logger.log path:path, project_id:project._id, folderName:folderName, "making folder from mkdirp"
						self.addFolder.withoutLock project_id, parentFolder_id, folderName, (err, newFolder, parentFolder_id)->
							return callback(err) if err?
							newFolder.parentFolder_id = parentFolder_id
							previousFolders.push newFolder
							callback null, previousFolders
					else
						foundFolder.filterOut = true
						previousFolders.push foundFolder
						callback  null, previousFolders

			async.reduce folders, [], procesFolder, (err, folders) ->
				return callback(err) if err?
				lastFolder = folders[folders.length-1]
				folders = _.select folders, (folder)->
					!folder.filterOut
				callback null, folders, lastFolder

	moveEntity: wrapWithLock (project_id, entity_id, destFolderId, entityType, callback = (error) ->) ->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (err, project) ->
			return callback(err) if err?
			ProjectLocator.findElement {project, element_id: entity_id, type: entityType}, (err, entity, entityPath)->
				return callback(err) if err?
				# Prevent top-level docs/files with reserved names (to match v1 behaviour)
				if self._blockedFilename entityPath, entityType
					return callback new Errors.InvalidNameError("blocked element name")
				self._checkValidMove project, entityType, entity, entityPath, destFolderId, (error) ->
					return callback(error) if error?
					ProjectEntityHandler.getAllEntitiesFromProject project, (error, oldDocs, oldFiles) ->
						return callback(error) if error?
						self._removeElementFromMongoArray Project, project_id, entityPath.mongo, (err, newProject)->
							return callback(err) if err?
							self._putElement newProject, destFolderId, entity, entityType, (err, result, newProject)->
								return callback(err) if err?
								ProjectEntityHandler.getAllEntitiesFromProject newProject, (err, newDocs, newFiles) ->
									return callback(err) if err?
									startPath = entityPath.fileSystem
									endPath = result.path.fileSystem
									changes = {oldDocs, newDocs, oldFiles, newFiles, newProject}
									callback null, project, startPath, endPath, entity.rev, changes, callback

	deleteEntity: wrapWithLock (project_id, entity_id, entityType, callback) ->
		ProjectGetter.getProjectWithoutLock project_id, {name:true, rootFolder:true, overleaf:true}, (error, project) ->
			return callback(error) if error?
			ProjectLocator.findElement {project: project, element_id: entity_id, type: entityType}, (error, entity, path) ->
				return callback(error) if error?
				self._removeElementFromMongoArray Project, project_id, path.mongo, (error, newProject) ->
					return callback(error) if error?
					callback null, entity, path, project, newProject

	renameEntity: wrapWithLock (project_id, entity_id, entityType, newName, callback) ->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (error, project)=>
			return callback(error) if error?
			ProjectEntityHandler.getAllEntitiesFromProject project, (error, oldDocs, oldFiles) =>
				return callback(error) if error?
				ProjectLocator.findElement {project:project, element_id:entity_id, type:entityType}, (error, entity, entPath, parentFolder)=>
					return callback(error) if error?
					endPath = path.join(path.dirname(entPath.fileSystem), newName)
					# Prevent top-level docs/files with reserved names (to match v1 behaviour)
					if self._blockedFilename {fileSystem: endPath}, entityType
						return callback new Errors.InvalidNameError("blocked element name")
					# check if the new name already exists in the current folder
					self._checkValidElementName parentFolder, newName, (error) =>
						return callback(error) if error?
						conditions = {_id:project_id}
						update = "$set":{}, "$inc":{}
						namePath = entPath.mongo+".name"
						update["$set"][namePath] = newName
						# we need to increment the project version number for any structure change
						update["$inc"]["version"] = 1
						Project.findOneAndUpdate conditions, update, { "new": true}, (error, newProject) ->
							return callback(error) if error?
							ProjectEntityHandler.getAllEntitiesFromProject newProject, (error, newDocs, newFiles) =>
								return callback(error) if error?
								startPath = entPath.fileSystem
								changes = {oldDocs, newDocs, oldFiles, newFiles, newProject}
								callback null, project, startPath, endPath, entity.rev, changes, callback

	addFolder: wrapWithLock (project_id, parentFolder_id, folderName, callback) ->
		ProjectGetter.getProjectWithoutLock project_id, {rootFolder:true, name:true, overleaf:true}, (err, project) ->
			if err?
				logger.err project_id:project_id, err:err, "error getting project for add folder"
				return callback(err)
			self._confirmFolder project, parentFolder_id, (parentFolder_id) =>
				folder = new Folder name: folderName
				logger.log project: project._id, parentFolder_id:parentFolder_id, folderName:folderName, "adding new folder"
				self._putElement project, parentFolder_id, folder, "folder", (err)=>
					if err?
						logger.err err:err, project_id:project._id, "error adding folder to project"
						return callback(err)
					callback null, folder, parentFolder_id

	_removeElementFromMongoArray: (model, model_id, path, callback = (err, project) ->)->
		conditions = {_id:model_id}
		update = {"$unset":{}}
		update["$unset"][path] = 1
		model.update conditions, update, {}, (err)->
			pullUpdate = {"$pull":{}, "$inc":{}}
			nonArrayPath = path.slice(0, path.lastIndexOf("."))
			pullUpdate["$pull"][nonArrayPath] = null
			# we need to increment the project version number for any structure change
			pullUpdate["$inc"]["version"] = 1
			model.findOneAndUpdate conditions, pullUpdate, {"new": true}, callback

	_countElements: (project)->
		countFolder = (folder)->
			total = 0

			for subfolder in folder?.folders or []
				total += countFolder(subfolder)

			if folder?.folders?.length?
				total += folder.folders.length

			if folder?.docs?.length?
				total += folder.docs.length

			if folder?.fileRefs?.length?
				total += folder.fileRefs.length

			total

		countFolder project.rootFolder[0]

	_putElement: (project, folder_id, element, type, callback = (err, path, project)->)->
		sanitizeTypeOfElement = (elementType)->
			lastChar = elementType.slice -1
			if lastChar != "s"
				elementType +="s"
			if elementType == "files"
				elementType = "fileRefs"
			return elementType

		if !element? or !element._id?
			e = new Error("no element passed to be inserted")
			logger.err project_id:project._id, folder_id:folder_id, element:element, type:type, "failed trying to insert element as it was null"
			return callback(e)
		type = sanitizeTypeOfElement type

		# original check path.resolve("/", element.name) isnt "/#{element.name}" or element.name.match("/")
		# check if name is allowed
		if not SafePath.isCleanFilename element.name
			e = new Errors.InvalidNameError("invalid element name")
			logger.err project_id:project._id, folder_id:folder_id, element:element, type:type, "failed trying to insert element as name was invalid"
			return callback(e)

		if !folder_id?
			folder_id = project.rootFolder[0]._id

		if self._countElements(project) > settings.maxEntitiesPerProject
			logger.warn project_id:project._id, "project too big, stopping insertions"
			CooldownManager.putProjectOnCooldown(project._id)
			return callback("project_has_to_many_files")

		ProjectLocator.findElement {project:project, element_id:folder_id, type:"folders"}, (err, folder, path)=>
			if err?
				logger.err err:err, project_id:project._id, folder_id:folder_id, type:type, element:element, "error finding folder for _putElement"
				return callback(err)
			newPath =
				fileSystem: "#{path.fileSystem}/#{element.name}"
				mongo: path.mongo
			# check if the path would be too long
			if not SafePath.isAllowedLength newPath.fileSystem
				return callback new Errors.InvalidNameError("path too long")
			# Prevent top-level docs/files with reserved names (to match v1 behaviour)
			if self._blockedFilename newPath, type
				return callback new Errors.InvalidNameError("blocked element name")
			self._checkValidElementName folder, element.name, (err) =>
				return callback(err) if err?
				id = element._id+''
				element._id = require('mongoose').Types.ObjectId(id)
				conditions = _id:project._id
				mongopath = "#{path.mongo}.#{type}"
				update = "$push":{}, "$inc":{}
				update["$push"][mongopath] = element
				# we need to increment the project version number for any structure change
				update["$inc"]["version"] = 1 # increment project version number
				logger.log project_id: project._id, element_id: element._id, fileType: type, folder_id: folder_id, mongopath:mongopath, "adding element to project"
				# We are using Mongoose here, but if we ever switch to a direct mongo call
				# the next line will need to be updated to {returnNewDocument:true}
				Project.findOneAndUpdate conditions, update, {"new": true}, (err, newProject)->
					if err?
						logger.err err: err, project_id: project._id, 'error saving in putElement project'
						return callback(err)
					callback(err, {path:newPath}, newProject)

	_blockedFilename: (entityPath, entityType) ->
		# check if name would be blocked in v1
		# javascript reserved names are forbidden for docs and files
		# at the top-level (but folders with reserved names are allowed).
		isFolder = (entityType in ['folder', 'folders'])
		[dir, file] = [path.dirname(entityPath.fileSystem), path.basename(entityPath.fileSystem)]
		isTopLevel = dir is '/'
		if isTopLevel and !isFolder && SafePath.isBlockedFilename file
			return true
		else
			return false

	_checkValidElementName: (folder, name, callback = (err) ->) ->
		# check if the name is already taken by a doc, file or
		# folder. If so, return an error "file already exists".
		err = new Errors.InvalidNameError("file already exists")
		for doc in folder?.docs or []
			return callback(err) if doc.name is name
		for file in folder?.fileRefs or []
			return callback(err) if file.name is name
		for folder in folder?.folders or []
			return callback(err) if folder.name is name
		callback()

	_confirmFolder: (project, folder_id, callback)->
		logger.log folder_id:folder_id, project_id:project._id, "confirming folder in project"
		if folder_id+'' == 'undefined'
			callback(project.rootFolder[0]._id)
		else if folder_id != null
			callback folder_id
		else
			callback(project.rootFolder[0]._id)

	_checkValidMove: (project, entityType, entity, entityPath, destFolderId, callback = (error) ->) ->
		ProjectLocator.findElement { project, element_id: destFolderId, type:"folder"}, (err, destEntity, destFolderPath) ->
			return callback(err) if err?
			# check if there is already a doc/file/folder with the same name
			# in the destination folder
			self._checkValidElementName destEntity, entity.name, (err)->
				return callback(err) if err?
				if /folder/.test(entityType)
					logger.log destFolderPath: destFolderPath.fileSystem, folderPath: entityPath.fileSystem, "checking folder is not moving into child folder"
					isNestedFolder = destFolderPath.fileSystem.slice(0, entityPath.fileSystem.length) == entityPath.fileSystem
					if isNestedFolder
						return callback(new Errors.InvalidNameError("destination folder is a child folder of me"))
				callback()

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

	_insertDeletedFileReference: (project_id, fileRef, callback = (error) ->) ->
		Project.update {
			_id: project_id
		}, {
			$push: {
				deletedFiles: {
					_id:  fileRef._id
					name: fileRef.name
					linkedFileData: fileRef.linkedFileData
					deletedAt: new Date()
				}
			}
		}, {}, callback
