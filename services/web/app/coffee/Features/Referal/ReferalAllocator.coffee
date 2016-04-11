_ = require("underscore")
logger = require('logger-sharelatex')
User = require('../../models/User').User
SubscriptionLocator = require "../Subscription/SubscriptionLocator"
Settings = require "settings-sharelatex"

module.exports = ReferalAllocator =
	allocate: (referal_id, new_user_id, referal_source, referal_medium, callback = ->)->
		if !referal_id?
			return logger.log new_user_id:new_user_id, "no referal for user"
		logger.log referal_id:referal_id, new_user_id:new_user_id, "allocating users referal"

		query = {"referal_id":referal_id}
		User.findOne query, (error, user) ->
			return callback(error) if error?
			return callback(new Error("user not found")) if !user? or !user._id?

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
					ReferalAllocator.assignBonus user._id, callback
			else
				callback()



	assignBonus: (user_id, callback = (error) ->) ->
		query = _id: user_id
		User.findOne query, (error, user) ->
			return callback(error) if error
			return callback(new Error("user not found #{user_id} for assignBonus")) if !user?
			logger.log user_id: user_id, refered_user_count: user.refered_user_count, "assigning bonus"
			if user.refered_user_count? and user.refered_user_count > 0
				newFeatures = ReferalAllocator._calculateFeatures(user)
				if _.isEqual newFeatures, user.features
					return callback()
				User.update query, { $set: features: newFeatures }, callback
			else
				callback()

	_calculateFeatures : (user)->
		bonusLevel = ReferalAllocator._getBonusLevel(user)
		currentFeatures = _.clone(user.features) #need to clone because we exend with underscore later
		betterBonusFeatures = {}
		_.each Settings.bonus_features["#{bonusLevel}"], (bonusLevel, key)->
			currentLevel = user?.features?[key]
			if _.isBoolean(currentLevel) and currentLevel == false
				betterBonusFeatures[key] = bonusLevel

			if _.isNumber(currentLevel)
				if currentLevel == -1
					return
				bonusIsGreaterThanCurrent = currentLevel < bonusLevel
				if bonusIsGreaterThanCurrent or bonusLevel == -1
					betterBonusFeatures[key] = bonusLevel
		newFeatures = _.extend(currentFeatures, betterBonusFeatures)
		return newFeatures


	_getBonusLevel: (user)->
		highestBonusLevel = 0
		_.each _.keys(Settings.bonus_features), (level)->
			levelIsLessThanUser = level <= user.refered_user_count
			levelIsMoreThanCurrentHighest = level >= highestBonusLevel
			if levelIsLessThanUser and levelIsMoreThanCurrentHighest
				highestBonusLevel = level
		return highestBonusLevel
