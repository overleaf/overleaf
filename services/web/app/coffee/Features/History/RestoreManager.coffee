Settings = require 'settings-sharelatex'
Path = require 'path'
FileWriter = require '../../infrastructure/FileWriter'
FileSystemImportManager = require '../Uploads/FileSystemImportManager'
ProjectLocator = require '../Project/ProjectLocator'

module.exports = RestoreManager =
	restoreFile: (user_id, project_id, version, pathname, callback = (error) ->) ->
		RestoreManager._writeFileVersionToDisk project_id, version, pathname, (error, fsPath) ->
			return callback(error) if error?
			basename = Path.basename(pathname)
			dirname = Path.dirname(pathname)
			if dirname == '.' # no directory
				dirname = ''
			ProjectLocator.findElementByPath {project_id, path: dirname}, (error, element, type) ->
				return callback(error) if error?
				# We're going to try to recover the file into the folder it was in previously,
				# but this is historical, so the folder may not exist anymore. Fallback to the 
				# root folder if not (parent_folder_id == null will default to this)
				if type == 'folder' and element?
					parent_folder_id = element._id
				else
					parent_folder_id = null
				# TODO if we get a name conflict error from here, then retry with a timestamp appended
				FileSystemImportManager.addEntity user_id, project_id, parent_folder_id, basename, fsPath, false, callback

	_writeFileVersionToDisk: (project_id, version, pathname, callback = (error, fsPath) ->) ->
		url = "#{Settings.apis.project_history.url}/project/#{project_id}/version/#{version}/#{pathname}"
		FileWriter.writeUrlToDisk project_id, url, callback