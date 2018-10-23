_ = require("underscore")
logger = require('logger-sharelatex')
User = require('../../models/User').User
Settings = require "settings-sharelatex"
FeaturesUpdater = require "../Subscription/FeaturesUpdater"

module.exports = ReferalAllocator =
	allocate: (referal_id, new_user_id, referal_source, referal_medium, callback = ->)->
		if !referal_id?
			logger.log new_user_id:new_user_id, "no referal for user"
			return callback(null)

		logger.log referal_id:referal_id, new_user_id:new_user_id, referal_source:referal_source, referal_medium:referal_medium, "allocating users referal"

		query = {"referal_id":referal_id}
		User.findOne query, (error, user) ->
			return callback(error) if error?
			if !user? or !user._id?
				logger.log new_user_id:new_user_id, referal_id:referal_id, "no user found for referal id"
				return callback(null)

			if referal_source == "bonus"
				User.update query, {
					$push:
						refered_users: new_user_id
					$inc:
						refered_user_count: 1
				}, {}, (err)->
					if err?
						logger.err err:err, referal_id:referal_id, new_user_id:new_user_id, "something went wrong allocating referal"
						return callback(err)

					FeaturesUpdater.refreshFeatures user._id, callback
			else
				callback()
