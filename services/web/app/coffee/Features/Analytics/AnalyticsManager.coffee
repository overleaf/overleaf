Settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
_ = require "underscore"

if !Settings.analytics?.postgres?
	module.exports =
		recordEvent: (user_id, event, segmentation, callback = () ->) ->
			logger.log {user_id, event, segmentation}, "no event tracking configured, logging event"
			callback()
else
	Sequelize = require "sequelize"
	options = _.extend {logging:false}, Settings.analytics.postgres

	sequelize = new Sequelize(
		Settings.analytics.postgres.database,
		Settings.analytics.postgres.username,
		Settings.analytics.postgres.password,
		options
	)
	
	Event = sequelize.define("Event", {
		user_id: Sequelize.STRING,
		event: Sequelize.STRING,
		segmentation: Sequelize.JSONB
	})

	module.exports =
		recordEvent: (user_id, event, segmentation = {}, callback = (error) ->) ->
			if user_id? and typeof(user_id) != "string"
				user_id = user_id.toString()
			if user_id == Settings.smokeTest?.userId
				# Don't record smoke tests analytics
				return callback()
			Event
				.create({ user_id, event, segmentation })
				.then(
					(result) -> callback(),
					(error) ->
						logger.err {err: error, user_id, event, segmentation}, "error recording analytics event"
						callback(error)
				)
			
		sync: () -> sequelize.sync()