logger  = require "logger-sharelatex"
metrics = require "../../infrastructure/Metrics"
fs      = require "fs"
Path    = require "path"
FileSystemImportManager = require "./FileSystemImportManager"
ProjectUploadManager    = require "./ProjectUploadManager"

module.exports = ProjectUploadController =
	uploadProject: (req, res, next) ->
		timer = new metrics.Timer("project-upload")
		user_id = req.session.user._id
		{originalname, path} = req.files.qqfile
		name = Path.basename(originalname, ".zip")
		ProjectUploadManager.createProjectFromZipArchive user_id, name, path, (error, project) ->
			fs.unlink path, ->
			timer.done()
			if error?
				logger.error
					err: error, file_path: path, file_name: name,
					"error uploading project"
				res.send success: false
			else
				logger.log
					project: project._id, file_path: path, file_name: name,
					"uploaded project"
				res.send success: true, project_id: project._id
	
	uploadFile: (req, res, next) ->
		timer = new metrics.Timer("file-upload")
		name = req.files.qqfile.originalname
		path = req.files.qqfile.path
		project_id   = req.params.Project_id
		folder_id    = req.query.folder_id
		if !name? or name.length == 0 or name.length > 150
			logger.err project_id:project_id, name:name, "bad name when trying to upload file"
			return res.send success: false
		logger.log folder_id:folder_id, project_id:project_id, "getting upload file request"
		user_id = req.session.user._id
		FileSystemImportManager.addEntity user_id, project_id, folder_id, name, path, true, (error, entity) ->
			fs.unlink path, ->
			timer.done()
			if error?
				logger.error
					err: error, project_id: project_id, file_path: path,
					file_name: name, folder_id: folder_id,
					"error uploading file"
				res.send success: false
			else
				logger.log
					project_id: project_id, file_path: path, file_name: name, folder_id: folder_id
					"uploaded file"
				res.send success: true, entity_id: entity?._id



