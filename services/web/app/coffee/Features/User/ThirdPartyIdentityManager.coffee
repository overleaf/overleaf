Errors = require "../Errors/Errors"
User = require("../../models/User").User
UserStub = require("../../models/UserStub").UserStub
UserUpdater = require "./UserUpdater"
_ = require "lodash"

module.exports = ThirdPartyIdentityManager =
	login: (providerId, externalUserId, externalData, callback) ->
		return callback(new Error "invalid arguments") unless providerId? and externalUserId?
		query = ThirdPartyIdentityManager._loginQuery providerId, externalUserId
		User.findOne query, (err, user) ->
			return callback err if err?
			return callback(new Errors.ThirdPartyUserNotFoundError()) unless user
			return callback(null, user) unless externalData
			update = ThirdPartyIdentityManager._loginUpdate user, providerId, externalUserId, externalData
			User.findOneAndUpdate query, update, {new: true}, callback

	# attempt to login normally but check for user stub if user not found
	loginUserStub: (providerId, externalUserId, externalData, callback) ->
		ThirdPartyIdentityManager.login providerId, externalUserId, externalData, (err, user) ->
			return callback null, user unless err?
			return callback err unless err.name == "ThirdPartyUserNotFoundError"
			query = ThirdPartyIdentityManager._loginQuery providerId, externalUserId
			UserStub.findOne query, (err, userStub) ->
				return callback err if err?
				return callback(new Errors.ThirdPartyUserNotFoundError()) unless userStub
				return callback(null, userStub) unless externalData
				update = ThirdPartyIdentityManager._loginUpdate userStub, providerId, externalUserId, externalData
				UserStub.findOneAndUpdate query, update, {new: true}, callback

	_loginQuery: (providerId, externalUserId) ->
		externalUserId = externalUserId.toString()
		providerId = providerId.toString()
		query =
			"thirdPartyIdentifiers.externalUserId": externalUserId
			"thirdPartyIdentifiers.providerId": providerId
		return query

	_loginUpdate: (user, providerId, externalUserId, externalData) ->
		providerId = providerId.toString()
		# get third party identifier object from array
		thirdPartyIdentifier = user.thirdPartyIdentifiers.find (tpi) ->
			tpi.externalUserId == externalUserId and tpi.providerId == providerId
		# do recursive merge of new data over existing data
		_.merge(thirdPartyIdentifier.externalData, externalData)
		update = "thirdPartyIdentifiers.$": thirdPartyIdentifier
		return update

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
