async = require "async"
fs    = require "fs"
_     = require "underscore"
FileTypeManager  = require "./FileTypeManager"
EditorController = require "../Editor/EditorController"
ProjectLocator   = require "../Project/ProjectLocator"

module.exports = FileSystemImportManager =
	addDoc: (project_id, folder_id, name, path, replace, callback = (error, doc)-> )->
		fs.readFile path, "utf8", (error, content = "") ->
			return callback(error) if error?
			content = content.replace(/\r/g, "")
			lines = content.split("\n")
			EditorController.addDoc project_id, folder_id, name, lines, callback

	addFile: (project_id, folder_id, name, path, replace, callback = (error, file)-> )->
		if replace
			ProjectLocator.findElement project_id: project_id, element_id: folder_id, type: "folder", (error, folder) ->
				return callback(error) if error?
				return callback(new Error("Couldn't find folder")) if !folder?
				existingFile = null
				for fileRef in folder.fileRefs
					if fileRef.name == name
						existingFile = fileRef
						break
				if existingFile?
					EditorController.replaceFile project_id, existingFile._id, path, callback
				else
					EditorController.addFile project_id, folder_id, name, path, callback
		else
			EditorController.addFile project_id, folder_id, name, path, callback

	addFolder: (project_id, folder_id, name, path, replace, callback = (error)-> ) ->
		EditorController.addFolder project_id, folder_id, name, (error, new_folder) =>
			return callback(error) if error?
			@addFolderContents project_id, new_folder._id, path, replace, (error) ->
				return callback(error) if error?
				callback null, new_folder

	addFolderContents: (project_id, parent_folder_id, folderPath, replace, callback = (error)-> ) ->
		fs.readdir folderPath, (error, entries = []) =>
			return callback(error) if error?
			jobs = _.map entries, (entry) =>
				(callback) =>
					FileTypeManager.shouldIgnore entry, (error, ignore) =>
						return callback(error) if error?
						if !ignore
							@addEntity project_id, parent_folder_id, entry, "#{folderPath}/#{entry}", replace, callback
						else
							callback()
			async.parallelLimit jobs, 5, callback

	addEntity: (project_id, folder_id, name, path, replace, callback = (error, entity)-> ) ->
		FileTypeManager.isDirectory path, (error, isDirectory) =>
			return callback(error) if error?
			if isDirectory
				@addFolder project_id, folder_id, name, path, replace, callback
			else
				FileTypeManager.isBinary name, path, (error, isBinary) =>
					return callback(error) if error?
					if isBinary
						@addFile project_id, folder_id, name, path, replace, callback
					else
						@addDoc project_id, folder_id, name, path, replace, callback

