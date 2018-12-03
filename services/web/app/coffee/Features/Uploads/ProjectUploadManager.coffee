path = require "path"
rimraf = require "rimraf"
async = require "async"
ArchiveManager          = require "./ArchiveManager"
FileSystemImportManager = require "./FileSystemImportManager"
ProjectCreationHandler  = require "../Project/ProjectCreationHandler"
ProjectRootDocManager   = require "../Project/ProjectRootDocManager"
ProjectDetailsHandler   = require "../Project/ProjectDetailsHandler"
DocumentHelper          = require "../Documents/DocumentHelper"

module.exports = ProjectUploadHandler =
	createProjectFromZipArchive: (owner_id, defaultName, zipPath, callback = (error, project) ->) ->
		destination = @_getDestinationDirectory zipPath
		docPath = null
		project = null

		async.waterfall([
			(cb) ->
				ArchiveManager.extractZipArchive zipPath, destination, cb
			(cb) ->
				ProjectRootDocManager.findRootDocFileFromDirectory destination, (error, _docPath, docContents) ->
					cb(error, _docPath, docContents)
			(_docPath, docContents, cb) ->
				docPath = _docPath
				proposedName = DocumentHelper.getTitleFromTexContent(docContents || '') || defaultName
				ProjectDetailsHandler.generateUniqueName owner_id, proposedName, (error, name) ->
					cb(error, name)
			(name, cb) ->
				ProjectCreationHandler.createBlankProject owner_id, name, (error, _project) ->
					cb(error, _project)
			(_project, cb) =>
				project = _project
				@_insertZipContentsIntoFolder owner_id, project._id, project.rootFolder[0]._id, destination, cb
			(cb) ->
				if docPath?
					ProjectRootDocManager.setRootDocFromName project._id, docPath, (error) ->
						cb(error)
				else
					cb(null)
			(cb) ->
				cb(null, project)
		], callback)

	createProjectFromZipArchiveWithName: (owner_id, proposedName, zipPath, callback = (error, project) ->) ->
		ProjectDetailsHandler.generateUniqueName owner_id, proposedName, (error, name) =>
			return callback(error) if error?
			ProjectCreationHandler.createBlankProject owner_id, name, (error, project) =>
				return callback(error) if error?
				@insertZipArchiveIntoFolder owner_id, project._id, project.rootFolder[0]._id, zipPath, (error) ->
					return callback(error) if error?
					ProjectRootDocManager.setRootDocAutomatically project._id, (error) ->
						return callback(error) if error?
						callback(error, project)

	insertZipArchiveIntoFolder: (owner_id, project_id, folder_id, zipPath, callback = (error) ->) ->
		destination = @_getDestinationDirectory zipPath
		ArchiveManager.extractZipArchive zipPath, destination, (error) =>
			return callback(error) if error?

			@_insertZipContentsIntoFolder owner_id, project_id, folder_id, destination, callback

	_insertZipContentsIntoFolder: (owner_id, project_id, folder_id, destination, callback = (error) ->) ->
			ArchiveManager.findTopLevelDirectory destination, (error, topLevelDestination) ->
				return callback(error) if error?
				FileSystemImportManager.addFolderContents owner_id, project_id, folder_id, topLevelDestination, false, (error) ->
					return callback(error) if error?
					rimraf(destination, callback)

	_getDestinationDirectory: (source) ->
		return path.join(path.dirname(source), "#{path.basename(source, ".zip")}-#{Date.now()}")
		
