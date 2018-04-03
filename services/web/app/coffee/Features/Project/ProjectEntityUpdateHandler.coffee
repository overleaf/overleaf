_ = require 'lodash'
async = require 'async'
logger = require('logger-sharelatex')
path = require('path')
Doc = require('../../models/Doc').Doc
DocstoreManager = require('../Docstore/DocstoreManager')
DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
Errors = require '../Errors/Errors'
File = require('../../models/File').File
FileStoreHandler = require('../FileStore/FileStoreHandler')
LockManager = require('../../infrastructure/LockManager')
Project = require('../../models/Project').Project
ProjectEntityHandler = require('./ProjectEntityHandler')
ProjectGetter = require('./ProjectGetter')
ProjectLocator = require('./ProjectLocator')
ProjectUpdateHandler = require('./ProjectUpdateHandler')
ProjectEntityMongoUpdateHandler = require('./ProjectEntityMongoUpdateHandler')
SafePath = require './SafePath'
TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')

LOCK_NAMESPACE = "sequentialProjectStructureUpdateLock"

wrapWithLock = (methodWithoutLock) ->
	# This lock is used to make sure that the project structure updates are made
	# sequentially. In particular the updates must be made in mongo and sent to
	# the doc-updater in the same order.
	if typeof methodWithoutLock is 'function'
		methodWithLock = (project_id, args..., callback) ->
			LockManager.runWithLock LOCK_NAMESPACE, project_id,
				(cb) -> methodWithoutLock project_id, args..., cb
				callback
		methodWithLock.withoutLock = methodWithoutLock
		methodWithLock
	else
		# handle case with separate setup and locked stages
		wrapWithSetup = methodWithoutLock.beforeLock  # a function to set things up before the lock
		mainTask = methodWithoutLock.withLock # function to execute inside the lock
		methodWithLock = wrapWithSetup (project_id, args..., callback) ->
			LockManager.runWithLock(LOCK_NAMESPACE, project_id, (cb) ->
				mainTask(project_id, args..., cb)
			callback)
		methodWithLock.withoutLock = wrapWithSetup mainTask
		methodWithLock

module.exports = ProjectEntityUpdateHandler = self =
	# this doesn't need any locking because it's only called by ProjectDuplicator
	copyFileFromExistingProjectWithProject: (project, folder_id, originalProject_id, origonalFileRef, userId, callback = (error, fileRef, folder_id) ->)->
		project_id = project._id
		logger.log { project_id, folder_id, originalProject_id, origonalFileRef }, "copying file in s3 with project"
		return callback(err) if err?
		ProjectEntityMongoUpdateHandler._confirmFolder project, folder_id, (folder_id)=>
			if !origonalFileRef?
				logger.err { project_id, folder_id, originalProject_id, origonalFileRef }, "file trying to copy is null"
				return callback()
			# convert any invalid characters in original file to '_'
			fileRef = new File name : SafePath.clean(origonalFileRef.name)
			FileStoreHandler.copyFile originalProject_id, origonalFileRef._id, project._id, fileRef._id, (err, fileStoreUrl)->
				if err?
					logger.err { err, project_id, folder_id, originalProject_id, origonalFileRef }, "error coping file in s3"
					return callback(err)
				ProjectEntityMongoUpdateHandler._putElement project, folder_id, fileRef, "file", (err, result)=>
					if err?
						logger.err { err, project_id, folder_id }, "error putting element as part of copy"
						return callback(err)
					TpdsUpdateSender.addFile { project_id, file_id:fileRef._id, path:result?.path?.fileSystem, rev:fileRef.rev, project_name:project.name}, (err) ->
						if err?
							logger.err { err, project_id, folder_id, originalProject_id, origonalFileRef }, "error sending file to tpds worker"
						newFiles = [
							file: fileRef
							path: result?.path?.fileSystem
							url: fileStoreUrl
						]
						DocumentUpdaterHandler.updateProjectStructure project_id, userId, {newFiles}, (error) ->
							return callback(error) if error?
							callback null, fileRef, folder_id

	updateDocLines: (project_id, doc_id, lines, version, ranges, callback = (error) ->)->
		ProjectGetter.getProjectWithoutDocLines project_id, (err, project)->
			return callback(err) if err?
			return callback(new Errors.NotFoundError("project not found")) if !project?
			logger.log project_id: project_id, doc_id: doc_id, "updating doc lines"
			ProjectLocator.findElement {project:project, element_id:doc_id, type:"docs"}, (err, doc, path)->
				isDeletedDoc = false
				if err?
					if err instanceof Errors.NotFoundError
						# We need to be able to update the doclines of deleted docs. This is
						# so the doc-updater can flush a doc's content to the doc-store after
						# the doc is deleted.
						isDeletedDoc = true
						doc = _.find project.deletedDocs, (doc) ->
							doc._id.toString() == doc_id.toString()
					else
						return callback(err)

				if !doc?
					# Do not allow an update to a doc which has never exist on this project
					logger.error {doc_id, project_id, lines}, "doc not found while updating doc lines"
					return callback(new Errors.NotFoundError('doc not found'))

				logger.log {project_id, doc_id}, "telling docstore manager to update doc"
				DocstoreManager.updateDoc project_id, doc_id, lines, version, ranges, (err, modified, rev) ->
					if err?
						logger.error {err, doc_id, project_id, lines}, "error sending doc to docstore"
						return callback(err)
					logger.log {project_id, doc_id, modified}, "finished updating doc lines"
					# path will only be present if the doc is not deleted
					if modified && !isDeletedDoc
						# Don't need to block for marking as updated
						ProjectUpdateHandler.markAsUpdated project_id
						TpdsUpdateSender.addDoc {project_id:project_id, path:path.fileSystem, doc_id:doc_id, project_name:project.name, rev:rev}, callback
					else
						callback()

	setRootDoc: (project_id, newRootDocID, callback = (error) ->)->
		logger.log project_id: project_id, rootDocId: newRootDocID, "setting root doc"
		Project.update {_id:project_id}, {rootDoc_id:newRootDocID}, {}, callback

	unsetRootDoc: (project_id, callback = (error) ->) ->
		logger.log project_id: project_id, "removing root doc"
		Project.update {_id:project_id}, {$unset: {rootDoc_id: true}}, {}, callback

	restoreDoc: (project_id, doc_id, name, callback = (error, doc, folder_id) ->) ->
		if not SafePath.isCleanFilename name
			return callback new Errors.InvalidNameError("invalid element name")
		# getDoc will return the deleted doc's lines, but we don't actually remove
		# the deleted doc, just create a new one from its lines.
		ProjectEntityHandler.getDoc project_id, doc_id, include_deleted: true, (error, lines) ->
			return callback(error) if error?
			self.addDoc project_id, null, name, lines, callback

	addDoc: wrapWithLock (project_id, folder_id, docName, docLines, userId, callback = (error, doc, folder_id) ->)=>
		self.addDocWithoutUpdatingHistory.withoutLock project_id, folder_id, docName, docLines, userId, (error, doc, folder_id, path) ->
			return callback(error) if error?
			newDocs = [
				doc: doc
				path: path
				docLines: docLines.join('\n')
			]
			DocumentUpdaterHandler.updateProjectStructure project_id, userId, {newDocs}, (error) ->
				return callback(error) if error?
				callback null, doc, folder_id

	_uploadFile: (project_id, folder_id, fileName, fsPath, linkedFileData, userId, callback = (error, fileRef, fileStoreUrl) ->)->
		if not SafePath.isCleanFilename fileName
			return callback new Errors.InvalidNameError("invalid element name")
		fileRef = new File(
			name: fileName
			linkedFileData: linkedFileData
		)
		FileStoreHandler.uploadFileFromDisk project_id, fileRef._id, fsPath, (err, fileStoreUrl)->
			if err?
				logger.err err:err, project_id: project_id, folder_id: folder_id, file_name: fileName, fileRef:fileRef, "error uploading image to s3"
				return callback(err)
			callback(null, fileRef, fileStoreUrl)

	_addFileAndSendToTpds: (project_id, folder_id, fileName, fileRef, callback = (error) ->)->
		ProjectEntityMongoUpdateHandler.addFile project_id, folder_id, fileRef, (err, result, project) ->
			if err?
				logger.err err:err, project_id: project_id, folder_id: folder_id, file_name: fileName, fileRef:fileRef, "error adding file with project"
				return callback(err)
			TpdsUpdateSender.addFile {project_id:project_id, file_id:fileRef._id, path:result?.path?.fileSystem, project_name:project.name, rev:fileRef.rev}, (err) ->
				return callback(err) if err?
				callback(null, result, project)

	addFile: wrapWithLock
		beforeLock: (next) ->
			(project_id, folder_id, fileName, fsPath, linkedFileData, userId, callback) ->
				ProjectEntityUpdateHandler._uploadFile project_id, folder_id, fileName, fsPath, linkedFileData, userId, (error, fileRef, fileStoreUrl) ->
					return callback(error) if error?
					next(project_id, folder_id, fileName, fsPath, linkedFileData, userId, fileRef, fileStoreUrl, callback)
		withLock: (project_id, folder_id, fileName, fsPath, linkedFileData, userId, fileRef, fileStoreUrl, callback = (error, fileRef, folder_id) ->)->
			ProjectEntityUpdateHandler._addFileAndSendToTpds project_id, folder_id, fileName, fileRef, (err, result, project) ->
				return callback(err) if err?
				newFiles = [
					file: fileRef
					path: result?.path?.fileSystem
					url: fileStoreUrl
				]
				DocumentUpdaterHandler.updateProjectStructure project_id, userId, {newFiles}, (error) ->
					return callback(error) if error?
					callback(null, fileRef, folder_id)

	replaceFile: wrapWithLock
		beforeLock: (next) ->
			(project_id, file_id, fsPath, linkedFileData, userId, callback)->
				FileStoreHandler.uploadFileFromDisk project_id, file_id, fsPath, (err, fileStoreUrl)->
					return callback(err) if err?
					next project_id, file_id, fsPath, linkedFileData, userId, fileStoreUrl, callback
		withLock: (project_id, file_id, fsPath, linkedFileData, userId, fileStoreUrl, callback)->
			ProjectEntityMongoUpdateHandler.replaceFile project_id, file_id, linkedFileData, (err, fileRef, project, path) ->
				return callback(err) if err?
				newFiles = [
					file: fileRef
					path: path.fileSystem
					url: fileStoreUrl
				]
				TpdsUpdateSender.addFile {project_id:project._id, file_id:fileRef._id, path:path.fileSystem, rev:fileRef.rev+1, project_name:project.name}, (err) ->
					return callback(err) if err?
					DocumentUpdaterHandler.updateProjectStructure project_id, userId, {newFiles}, callback

	addDocWithoutUpdatingHistory: wrapWithLock (project_id, folder_id, docName, docLines, userId, callback = (error, doc, folder_id) ->)=>
		# This method should never be called directly, except when importing a project
		# from Overleaf. It skips sending updates to the project history, which will break
		# the history unless you are making sure it is updated in some other way.

		if not SafePath.isCleanFilename docName
			return callback new Errors.InvalidNameError("invalid element name")

		# Put doc in docstore first, so that if it errors, we don't have a doc_id in the project
		# which hasn't been created in docstore.
		doc = new Doc name: docName
		DocstoreManager.updateDoc project_id.toString(), doc._id.toString(), docLines, 0, {}, (err, modified, rev) ->
			return callback(err) if err?
			ProjectEntityMongoUpdateHandler.addDoc project_id, folder_id, doc, (err, result, project) ->
				return callback(err) if err?
				TpdsUpdateSender.addDoc {
					project_id:   project_id,
					doc_id:		    doc?._id
					path:         result?.path?.fileSystem,
					project_name: project.name,
					rev:          0
				}, (err) ->
					return callback(err) if err?
					callback(null, doc, folder_id, result?.path?.fileSystem)

	addFileWithoutUpdatingHistory: wrapWithLock
		# This method should never be called directly, except when importing a project
		# from Overleaf. It skips sending updates to the project history, which will break
		# the history unless you are making sure it is updated in some other way.
		beforeLock: (next) ->
			(project_id, folder_id, fileName, fsPath, linkedFileData, userId, callback) ->
				ProjectEntityUpdateHandler._uploadFile project_id, folder_id, fileName, fsPath, linkedFileData, userId, (error, fileRef, fileStoreUrl) ->
					return callback(error) if error?
					next(project_id, folder_id, fileName, fsPath, linkedFileData, userId, fileRef, fileStoreUrl, callback)
		withLock: (project_id, folder_id, fileName, fsPath, linkedFileData, userId, fileRef, fileStoreUrl, callback = (error, fileRef, folder_id, path, fileStoreUrl) ->)->
			ProjectEntityUpdateHandler._addFileAndSendToTpds project_id, folder_id, fileName, fileRef, (err, result, project) ->
				return callback(err) if err?
				callback(null, fileRef, folder_id, result?.path?.fileSystem, fileStoreUrl)

	upsertDoc: wrapWithLock (project_id, folder_id, docName, docLines, source, userId, callback = (err, doc, folder_id, isNewDoc)->)->
		ProjectLocator.findElement project_id: project_id, element_id: folder_id, type: "folder", (error, folder) ->
			return callback(error) if error?
			return callback(new Error("Couldn't find folder")) if !folder?
			existingDoc = null
			for doc in folder.docs
				if doc.name == docName
					existingDoc = doc
					break
			if existingDoc?
				DocumentUpdaterHandler.setDocument project_id, existingDoc._id, userId, docLines, source, (err)=>
					logger.log project_id:project_id, doc_id:existingDoc._id, "notifying users that the document has been updated"
					DocumentUpdaterHandler.flushDocToMongo project_id, existingDoc._id, (err) ->
						return callback(err) if err?
						callback null, existingDoc, !existingDoc?
			else
				self.addDoc.withoutLock project_id, folder_id, docName, docLines, userId, (err, doc) ->
					return callback(err) if err?
					callback null, doc, !existingDoc?

	# FIXME: this method needs to be changed, currently it needs a lock around an upload to S3 because
	# there is no way to know in advance if the file is a replace or an insert (at least you have to
	# take the lock to find that out and do any operation in that lock).  In the new scheme any upsert
	# should always create the new file (outside the lock) in S3 first and then make the changes to the
	# project in a lock, marking the old file as deleted if it exists.
	upsertFile: wrapWithLock (project_id, folder_id, fileName, fsPath, linkedFileData, userId, callback = (err, file, isNewFile)->)->
		ProjectLocator.findElement project_id: project_id, element_id: folder_id, type: "folder", (error, folder) ->
			return callback(error) if error?
			return callback(new Error("Couldn't find folder")) if !folder?
			existingFile = null
			for fileRef in folder.fileRefs
				if fileRef.name == fileName
					existingFile = fileRef
					break
			if existingFile?
				self.replaceFile.withoutLock project_id, existingFile._id, fsPath, linkedFileData, userId, (err) ->
					return callback(err) if err?
					callback null, existingFile, !existingFile?
			else
				self.addFile.withoutLock project_id, folder_id, fileName, fsPath, linkedFileData, userId, (err, file) ->
					return callback(err) if err?
					callback null, file, !existingFile?

	upsertDocWithPath: wrapWithLock (project_id, elementPath, docLines, source, userId, callback) ->
		docName = path.basename(elementPath)
		folderPath = path.dirname(elementPath)
		self.mkdirp.withoutLock project_id, folderPath, (err, newFolders, folder) ->
			return callback(err) if err?
			self.upsertDoc.withoutLock project_id, folder._id, docName, docLines, source, userId, (err, doc, isNewDoc) ->
				return callback(err) if err?
				callback null, doc, isNewDoc, newFolders, folder

	upsertFileWithPath: wrapWithLock (project_id, elementPath, fsPath, linkedFileData, userId, callback) ->
		fileName = path.basename(elementPath)
		folderPath = path.dirname(elementPath)
		self.mkdirp.withoutLock project_id, folderPath, (err, newFolders, folder) ->
			return callback(err) if err?
			self.upsertFile.withoutLock project_id, folder._id, fileName, fsPath, linkedFileData, userId, (err, file, isNewFile) ->
				return callback(err) if err?
				callback null, file, isNewFile, newFolders, folder

	deleteEntity: wrapWithLock (project_id, entity_id, entityType, userId, callback = (error) ->)->
		logger.log entity_id:entity_id, entityType:entityType, project_id:project_id, "deleting project entity"
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		ProjectEntityMongoUpdateHandler.deleteEntity project_id, entity_id, entityType, (error, entity, path, projectBeforeDeletion) ->
			return callback(error) if error?
			self._cleanUpEntity projectBeforeDeletion, entity, entityType, path.fileSystem, userId, (error) ->
				return callback(error) if error?
				TpdsUpdateSender.deleteEntity project_id:project_id, path:path.fileSystem, project_name:projectBeforeDeletion.name, (error) ->
					return callback(error) if error?
					callback null, entity_id

	deleteEntityWithPath: wrapWithLock (project_id, path, userId, callback) ->
		ProjectLocator.findElementByPath project_id: project_id, path: path, (err, element, type)->
			return callback(err) if err?
			return callback(new Errors.NotFoundError("project not found")) if !element?
			self.deleteEntity.withoutLock project_id, element._id, type, userId, callback

	mkdirp: wrapWithLock (project_id, path, callback = (err, newlyCreatedFolders, lastFolderInPath)->)->
		ProjectEntityMongoUpdateHandler.mkdirp project_id, path, callback

	addFolder: wrapWithLock (project_id, parentFolder_id, folderName, callback) ->
		if not SafePath.isCleanFilename folderName
			return callback new Errors.InvalidNameError("invalid element name")
		ProjectEntityMongoUpdateHandler.addFolder project_id, parentFolder_id, folderName, callback

	moveEntity: wrapWithLock (project_id, entity_id, destFolderId, entityType, userId, callback = (error) ->)->
		logger.log {entityType, entity_id, project_id, destFolderId}, "moving entity"
		if !entityType?
			logger.err {err: "No entityType set", project_id, entity_id}
			return callback("No entityType set")
		entityType = entityType.toLowerCase()
		ProjectEntityMongoUpdateHandler.moveEntity project_id, entity_id, destFolderId, entityType, (err, project_name, startPath, endPath, rev, changes) ->
			return callback(err) if err?
			TpdsUpdateSender.moveEntity { project_id, project_name, startPath, endPath, rev }
			DocumentUpdaterHandler.updateProjectStructure project_id, userId, changes, callback

	renameEntity: wrapWithLock (project_id, entity_id, entityType, newName, userId, callback)->
		if not SafePath.isCleanFilename newName
			return callback new Errors.InvalidNameError("invalid element name")
		logger.log(entity_id: entity_id, project_id: project_id, ('renaming '+entityType))
		if !entityType?
			logger.err err: "No entityType set", project_id: project_id, entity_id: entity_id
			return callback("No entityType set")
		entityType = entityType.toLowerCase()

		ProjectEntityMongoUpdateHandler.renameEntity project_id, entity_id, entityType, newName, (err, project_name, startPath, endPath, rev, changes) ->
			return callback(err) if err?
			TpdsUpdateSender.moveEntity({project_id, startPath, endPath, project_name, rev})
			DocumentUpdaterHandler.updateProjectStructure project_id, userId, changes, callback

	# This doesn't directly update project structure but we need to take the lock
	# to prevent anything else being queued before the resync update
	resyncProjectHistory: wrapWithLock (project_id, callback) ->
		ProjectGetter.getProject project_id, rootFolder: true, overleaf: true, (error, project) ->
			return callback(error) if error?

			if !project?.overleaf?.history?.id?
				error = new Errors.ProjectHistoryDisabledError("project history not enabled for #{project_id}")
				return callback(error)

			ProjectEntityHandler.getAllEntitiesFromProject project, (error, docs, files) ->
				return callback(error) if error?

				docs = _.map docs, (doc) ->
					doc: doc.doc._id
					path: doc.path

				files = _.map files, (file) ->
					file: file.file._id
					path: file.path
					url: FileStoreHandler._buildUrl(project_id, file.file._id)

				DocumentUpdaterHandler.resyncProjectHistory project_id, docs, files, callback
	_cleanUpEntity: (project, entity, entityType, path, userId, callback = (error) ->) ->
		if(entityType.indexOf("file") != -1)
			self._cleanUpFile project, entity, path, userId, callback
		else if (entityType.indexOf("doc") != -1)
			self._cleanUpDoc project, entity, path, userId, callback
		else if (entityType.indexOf("folder") != -1)
			self._cleanUpFolder project, entity, path, userId, callback
		else
			callback()

	_cleanUpDoc: (project, doc, path, userId, callback = (error) ->) ->
		project_id = project._id.toString()
		doc_id = doc._id.toString()
		unsetRootDocIfRequired = (callback) =>
			if project.rootDoc_id? and project.rootDoc_id.toString() == doc_id
				@unsetRootDoc project_id, callback
			else
				callback()

		unsetRootDocIfRequired (error) ->
			return callback(error) if error?
			self._insertDeletedDocReference project._id, doc, (error) ->
				return callback(error) if error?
				DocumentUpdaterHandler.deleteDoc project_id, doc_id, (error) ->
					return callback(error) if error?
					DocstoreManager.deleteDoc project_id, doc_id, (error) ->
						return callback(error) if error?
						changes = oldDocs: [ {doc, path} ]
						DocumentUpdaterHandler.updateProjectStructure project_id, userId, changes, callback

	_cleanUpFile: (project, file, path, userId, callback = (error) ->) ->
		project_id = project._id.toString()
		file_id = file._id.toString()
		FileStoreHandler.deleteFile project_id, file_id, (error) ->
			return callback(error) if error?
			changes = oldFiles: [ {file, path} ]
			DocumentUpdaterHandler.updateProjectStructure project_id, userId, changes, callback

	_cleanUpFolder: (project, folder, folderPath, userId, callback = (error) ->) ->
		jobs = []
		for doc in folder.docs
			do (doc) ->
				docPath = path.join(folderPath, doc.name)
				jobs.push (callback) -> self._cleanUpDoc project, doc, docPath, userId, callback

		for file in folder.fileRefs
			do (file) ->
				filePath = path.join(folderPath, file.name)
				jobs.push (callback) -> self._cleanUpFile project, file, filePath, userId, callback

		for childFolder in folder.folders
			do (childFolder) ->
				folderPath = path.join(folderPath, childFolder.name)
				jobs.push (callback) -> self._cleanUpFolder project, childFolder, folderPath, userId, callback

		async.series jobs, callback

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
