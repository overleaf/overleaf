CooldownManager = require('./CooldownManager')
logger = require('logger-sharelatex')


module.exports = CooldownMiddlewear =

	freezeProject: (req, res, next) ->
			projectId = req.params.Project_id
			CooldownManager.isProjectOnCooldown projectId, (err, projectIsOnCooldown) ->
				if err?
					return next(err)
				if projectIsOnCooldown
					logger.log {projectId}, "[Cooldown] project is on cooldown, denying request"
					return res.sendStatus(429)
				next()
