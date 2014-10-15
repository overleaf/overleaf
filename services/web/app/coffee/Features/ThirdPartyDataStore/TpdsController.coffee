tpdsUpdateHandler = require('./TpdsUpdateHandler')
UpdateMerger = require "./UpdateMerger"
logger = require('logger-sharelatex')
Path = require('path')
metrics = require("../../infrastructure/Metrics")

module.exports =
	mergeUpdate: (req, res)->
		metrics.inc("tpds.merge-update")
		{filePath, user_id, projectName} = parseParams(req)
		logger.log user_id:user_id, filePath:filePath, fullPath:req.params[0], projectName:projectName, "reciving update request from tpds"
		tpdsUpdateHandler.newUpdate user_id, projectName, filePath, req, (err)->
			logger.log user_id:user_id, filePath:filePath, fullPath:req.params[0], "sending response that tpdsUpdate has been completed"
			if err?
				logger.err err:err, user_id:user_id, filePath:filePath, "error reciving update from tpds"
				res.send(500)
			else
				logger.log user_id:user_id, filePath:filePath, projectName:projectName, "telling tpds update has been processed"
				res.send 200
			req.session.destroy()


	deleteUpdate: (req, res)->
		metrics.inc("tpds.delete-update")
		{filePath, user_id, projectName} = parseParams(req)
		logger.log user_id:user_id, filePath:filePath, projectName:projectName, fullPath:req.params[0], "reciving delete request from tpds"
		tpdsUpdateHandler.deleteUpdate user_id, projectName, filePath, (err)->
			if err?
				logger.err err:err, user_id:user_id, filePath:filePath, "error reciving update from tpds"
				res.send(500)
			else
				logger.log user_id:user_id, filePath:filePath, projectName:projectName, "telling tpds delete has been processed"
				res.send 200
			req.session.destroy()
	
	updateProjectContents: (req, res, next = (error) ->) ->
		{project_id} = req.params
		path = "/" + req.params[0] # UpdateMerger expects leading slash
		source = req.headers["x-sl-update-source"]
		logger.log project_id: project_id, path: path, source: source, "received project contents update"
		UpdateMerger.mergeUpdate project_id, path, req, source, (error) ->
			return next(error) if error?
			res.send(200)
			req.session.destroy()
			
	deleteProjectContents: (req, res, next = (error) ->) ->
		{project_id} = req.params
		path = "/" + req.params[0] # UpdateMerger expects leading slash
		source = req.headers["x-sl-update-source"]
		logger.log project_id: project_id, path: path, source: source, "received project contents delete request"
		UpdateMerger.deleteUpdate project_id, path, source, (error) ->
			return next(error) if error?
			res.send(200)
			req.session.destroy()

	parseParams: parseParams = (req)->
		path = req.params[0]
		user_id = req.params.user_id

		path = Path.join("/",path)
		if path.substring(1).indexOf('/') == -1
			filePath = "/"
			projectName = path.substring(1)
		else
			filePath = path.substring(path.indexOf("/",1))
			projectName = path.substring(0, path.indexOf("/",1))
			projectName = projectName.replace("/","")
			
		return filePath:filePath, user_id:user_id, projectName:projectName

