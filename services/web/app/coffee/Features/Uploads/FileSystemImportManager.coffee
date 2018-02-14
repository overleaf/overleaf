async = require "async"
fs    = require "fs"
_     = require "underscore"
FileTypeManager  = require "./FileTypeManager"
EditorController = require "../Editor/EditorController"
logger = require("logger-sharelatex")

module.exports = FileSystemImportManager =
	addDoc: (user_id, project_id, folder_id, name, path, replace, callback = (error, doc)-> )->
		FileSystemImportManager._isSafeOnFileSystem path, (err, isSafe)->
			if !isSafe
				logger.log user_id:user_id, project_id:project_id, folder_id:folder_id, name:name, path:path, "add doc is from symlink, stopping process"
				return callback("path is symlink")
			fs.readFile path, "utf8", (error, content = "") ->
				return callback(error) if error?
				content = content.replace(/\r/g, "")
				lines = content.split("\n")
				if replace
					EditorController.upsertDoc project_id, folder_id, name, lines, "upload", user_id, callback
				else
					EditorController.addDoc project_id, folder_id, name, lines, "upload", user_id, callback

	addFile: (user_id, project_id, folder_id, name, path, replace, callback = (error, file)-> )->
		FileSystemImportManager._isSafeOnFileSystem path, (err, isSafe)->
			if !isSafe
				logger.log user_id:user_id, project_id:project_id, folder_id:folder_id, name:name, path:path, "add file is from symlink, stopping insert"
				return callback("path is symlink")

			if replace
				EditorController.upsertFile project_id, folder_id, name, path, null, "upload", user_id, callback
			else
				EditorController.addFile project_id, folder_id, name, path, null, "upload", user_id, callback

	addFolder: (user_id, project_id, folder_id, name, path, replace, callback = (error)-> ) ->
		FileSystemImportManager._isSafeOnFileSystem path, (err, isSafe)->
			if !isSafe
				logger.log user_id:user_id, project_id:project_id, folder_id:folder_id, path:path, "add folder is from symlink, stopping insert"
				return callback("path is symlink")
			EditorController.addFolder project_id, folder_id, name, "upload", (error, new_folder) =>
				return callback(error) if error?
				FileSystemImportManager.addFolderContents user_id, project_id, new_folder._id, path, replace, (error) ->
					return callback(error) if error?
					callback null, new_folder

	addFolderContents: (user_id, project_id, parent_folder_id, folderPath, replace, callback = (error)-> ) ->
		FileSystemImportManager._isSafeOnFileSystem folderPath, (err, isSafe)->
			if !isSafe
				logger.log user_id:user_id, project_id:project_id, parent_folder_id:parent_folder_id, folderPath:folderPath, "add folder contents is from symlink, stopping insert"
				return callback("path is symlink")
			fs.readdir folderPath, (error, entries = []) =>
				return callback(error) if error?
				jobs = _.map entries, (entry) =>
					(callback) =>
						FileTypeManager.shouldIgnore entry, (error, ignore) =>
							return callback(error) if error?
							if !ignore
								FileSystemImportManager.addEntity user_id, project_id, parent_folder_id, entry, "#{folderPath}/#{entry}", replace, callback
							else
								callback()
				async.parallelLimit jobs, 5, callback

	addEntity: (user_id, project_id, folder_id, name, path, replace, callback = (error, entity)-> ) ->
		FileSystemImportManager._isSafeOnFileSystem path, (err, isSafe)->
			if !isSafe
				logger.log user_id:user_id, project_id:project_id, folder_id:folder_id, path:path, "add entry is from symlink, stopping insert"
				return callback("path is symlink")

			FileTypeManager.isDirectory path, (error, isDirectory) =>
				return callback(error) if error?
				if isDirectory
					FileSystemImportManager.addFolder user_id, project_id, folder_id, name, path, replace, callback
				else
					FileTypeManager.isBinary name, path, (error, isBinary) =>
						return callback(error) if error?
						if isBinary
							FileSystemImportManager.addFile user_id, project_id, folder_id, name, path, replace, (err, entity) ->
								entity?.type = 'file'
								callback(err, entity)
						else
							FileSystemImportManager.addDoc user_id, project_id, folder_id, name, path, replace, (err, entity) ->
								entity?.type = 'doc'
								callback(err, entity)


	_isSafeOnFileSystem: (path, callback = (err, isSafe)->)->
		fs.lstat path, (err, stat)->
			if err?
				logger.err err:err, "error with path symlink check"
				return callback(err)
			isSafe = stat.isFile() or stat.isDirectory()
			callback(err, isSafe)

