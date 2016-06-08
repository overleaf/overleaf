User = require("../../models/User").User
logger = require 'logger-sharelatex'
metrics = require("../../infrastructure/Metrics")

module.exports = BetaProgramHandler =

	optIn: (user_id, callback=(err)->) ->
		User.findById user_id, (err, user) ->
			if err
				logger.err {err, user_id}, "problem adding user to beta"
				return callback(err)
			metrics.inc "beta-program.opt-in"
			user.betaProgram = true
			user.save (err) ->
				if err
					logger.err {err, user_id}, "problem adding user to beta"
					return callback(err)
				return callback(null)
