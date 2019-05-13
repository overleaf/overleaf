Errors = require "../Errors/Errors"
User = require("../../models/User").User
UserUpdater = require "./UserUpdater"
_ = require "lodash"

module.exports = ThirdPartyIdentityManager =
	login: (providerId, externalUserId, externalData, callback) ->
		return callback(new Error "invalid arguments") unless providerId? and externalUserId?
		externalUserId = externalUserId.toString()
		providerId = providerId.toString()
		query =
			"thirdPartyIdentifiers.externalUserId": externalUserId
			"thirdPartyIdentifiers.providerId": providerId
		User.findOne query, (err, user) ->
			return callback err if err?
			return callback(new Errors.ThirdPartyUserNotFoundError()) unless user
			# skip updating data unless passed
			return callback(null, user) unless externalData
			# get third party identifier object from array
			thirdPartyIdentifier = user.thirdPartyIdentifiers.find (tpi) ->
				tpi.externalUserId == externalUserId and tpi.providerId == providerId
			# do recursive merge of new data over existing data
			_.merge(thirdPartyIdentifier.externalData, externalData)
			# update user
			update = "thirdPartyIdentifiers.$": thirdPartyIdentifier
			User.findOneAndUpdate query, update, {new: true}, callback

	# register: () ->
		# this should be implemented once we move to having v2 as the master
		# but for now we need to register with v1 then call link once that
		# is complete

	link: (user_id, providerId, externalUserId, externalData, callback, retry) ->
		query =
			_id: user_id
			"thirdPartyIdentifiers.providerId": $ne: providerId
		update = $push: thirdPartyIdentifiers:
			externalUserId: externalUserId
			externalData: externalData
			providerId: providerId
		# add new tpi only if an entry for the provider does not exist
		UserUpdater.updateUser query, update, (err, res) ->
			return callback err if err?
			return callback null, res if res.nModified == 1
			# if already retried then throw error
			return callback(new Error "update failed") if retry
			# attempt to clear existing entry then retry
			ThirdPartyIdentityManager.unlink user_id, providerId, (err) ->
				return callback err if err?
				ThirdPartyIdentityManager.link user_id, providerId, externalUserId, externalData, callback, true

	unlink: (user_id, providerId, callback) ->
		update = $pull: thirdPartyIdentifiers:
			providerId: providerId
		UserUpdater.updateUser user_id, update, callback
