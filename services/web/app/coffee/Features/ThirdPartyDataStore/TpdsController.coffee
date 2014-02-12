tpdsUpdateHandler = require('./TpdsUpdateHandler')
logger = require('logger-sharelatex')
Path = require('path')
metrics = require("../../infrastructure/Metrics")

module.exports =
	mergeUpdate: (req, res)->
		metrics.inc("tpds.merge-update")
		{filePath, user_id, projectName} = parseParams(req)
		logger.log user_id:user_id, filePath:filePath, fullPath:req.params[0], projectName:projectName, sl_req_id:req.sl_req_id, "reciving update request from tpds"
		tpdsUpdateHandler.newUpdate user_id, projectName, filePath, req, req.sl_req_id, (err)->
			logger.log user_id:user_id, filePath:filePath, fullPath:req.params[0], sl_req_id:req.sl_req_id, "sending response that tpdsUpdate has been completed"
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
		logger.log user_id:user_id, filePath:filePath, sl_req_id:req.sl_req_id, projectName:projectName, fullPath:req.params[0], "reciving delete request from tpds"
		tpdsUpdateHandler.deleteUpdate user_id, projectName, filePath, req.sl_req_id, (err)->
			if err?
				logger.err err:err, user_id:user_id, filePath:filePath, "error reciving update from tpds"
				res.send(500)
			else
				logger.log user_id:user_id, filePath:filePath, projectName:projectName, "telling tpds delete has been processed"
				res.send 200
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

