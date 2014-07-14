ConnectedUsersManager = require("./ConnectedUsersManager")
logger = require("logger-sharelatex")

module.exports = 

	getConnectedUsers: (req, res)->
		project_id = req.params.Project_id
		ConnectedUsersManager.getConnectedUsers project_id, (err, users)->
			if err?
				logger.err err:err, project_id:project_id, "problem getting connected users"
				return res.send 500
			res.send(users)

