logger = require('logger-sharelatex')
FileStoreHandler = require("./FileStoreHandler")
ProjectLocator = require("../Project/ProjectLocator")
 
module.exports =

	getFile : (req, res)->
		project_id = req.params.Project_id
		file_id = req.params.File_id
		queryString = req.query
		logger.log project_id: project_id, file_id: file_id, queryString:queryString, "file download"
		ProjectLocator.findElement {project_id: project_id, element_id: file_id, type: "file"}, (err, file)->
			if err?
				logger.err err:err, project_id: project_id, file_id: file_id, queryString:queryString, "error finding element for downloading file"
				return res.sendStatus 500
			FileStoreHandler.getFileStream project_id, file_id, queryString, (err, stream)->
				if err?
					logger.err err:err, project_id: project_id, file_id: file_id, queryString:queryString, "error getting file stream for downloading file"
					return res.sendStatus 500
				res.setHeader("Content-Disposition", "attachment; filename=#{file.name}")
				stream.pipe res