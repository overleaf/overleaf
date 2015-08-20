logger = require('logger-sharelatex')
FileStoreHandler = require("./FileStoreHandler")
ProjectLocator = require("../Project/ProjectLocator")
_ = require('underscore')

is_mobile_safari = (user_agent) ->
	user_agent and (user_agent.indexOf('iPhone') >= 0 or
									user_agent.indexOf('iPad') >= 0)

is_html = (file) ->
	file.name.lastIndexOf('.html') == file.name.length - 5

module.exports =

	getFile : (req, res)->
		project_id = req.params.Project_id
		file_id = req.params.File_id
		queryString = req.query
		user_agent = req.get('User-Agent')
		logger.log project_id: project_id, file_id: file_id, queryString:queryString, "file download"
		ProjectLocator.findElement {project_id: project_id, element_id: file_id, type: "file"}, (err, file)->
			if err?
				logger.err err:err, project_id: project_id, file_id: file_id, queryString:queryString, "error finding element for downloading file"
				return res.sendStatus 500
			FileStoreHandler.getFileStream project_id, file_id, queryString, (err, stream)->
				if err?
					logger.err err:err, project_id: project_id, file_id: file_id, queryString:queryString, "error getting file stream for downloading file"
					return res.sendStatus 500
				# mobile safari will try to render html files, prevent this
				if (is_mobile_safari(user_agent) and is_html(file))
					logger.log filename: file.name, user_agent: user_agent, "sending html file to mobile-safari as plain text"
					res.setHeader('Content-Type', 'text/plain')
				res.setHeader("Content-Disposition", "attachment; filename=#{file.name}")
				stream.pipe res
