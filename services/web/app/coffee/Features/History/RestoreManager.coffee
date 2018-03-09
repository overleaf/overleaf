Settings = require 'settings-sharelatex'
Path = require 'path'
FileWriter = require '../../infrastructure/FileWriter'
FileSystemImportManager = require '../Uploads/FileSystemImportManager'
ProjectLocator = require '../Project/ProjectLocator'
Errors = require '../Errors/Errors'
moment = require 'moment'

module.exports = RestoreManager =
	restoreFile: (user_id, project_id, version, pathname, callback = (error) ->) ->
		RestoreManager._writeFileVersionToDisk project_id, version, pathname, (error, fsPath) ->
			return callback(error) if error?
			basename = Path.basename(pathname)
			dirname = Path.dirname(pathname)
			if dirname == '.' # no directory
				dirname = ''
			RestoreManager._findFolderOrRootFolderId project_id, dirname, (error, parent_folder_id) ->
				return callback(error) if error?
				RestoreManager._addEntityWithUniqueName user_id, project_id, parent_folder_id, basename, fsPath, callback

	_findFolderOrRootFolderId: (project_id, dirname, callback = (error, folder_id) ->) ->
		# We're going to try to recover the file into the folder it was in previously,
		# but this is historical, so the folder may not exist anymore. Fallback to the 
		# root folder if not (folder_id == null)
		ProjectLocator.findElementByPath {project_id, path: dirname}, (error, element, type) ->
			if error? and not error instanceof Errors.NotFoundError
				return callback(error)
			if type == 'folder' and element?
				return callback(null, element._id)
			else
				return callback(null, null)

	_addEntityWithUniqueName: (user_id, project_id, parent_folder_id, basename, fsPath, callback = (error) ->) ->
		FileSystemImportManager.addEntity user_id, project_id, parent_folder_id, basename, fsPath, false, (error, entity) ->
			if error?
				console.log "ERROR", error, error instanceof Errors.InvalidNameError
				if error instanceof Errors.InvalidNameError
					# likely a duplicate name, so try with a prefix
					date = moment(new Date()).format('Do MMM YY H:mm:ss')
					# Move extension to the end so the file type is preserved
					extension = Path.extname(basename)
					basename = Path.basename(basename, extension)
					basename = "#{basename} (Restored on #{date})"
					if extension != ''
						basename = "#{basename}#{extension}"
					FileSystemImportManager.addEntity user_id, project_id, parent_folder_id, basename, fsPath, false, callback
				else
					callback(error)
			else
				callback()

	_writeFileVersionToDisk: (project_id, version, pathname, callback = (error, fsPath) ->) ->
		url = "#{Settings.apis.project_history.url}/project/#{project_id}/version/#{version}/#{encodeURIComponent(pathname)}"
		FileWriter.writeUrlToDisk project_id, url, callback