InactiveProjectManager = require("./InactiveProjectManager")

module.exports = 

	deactivateOldProjects: (req, res)->
		InactiveProjectManager.deactivateOldProjects 10, (err)->
			if err?
				res.sendStatus(500)
			else
				res.sendStatus(200)

