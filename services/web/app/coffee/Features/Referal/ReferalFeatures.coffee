_ = require("underscore")
logger = require('logger-sharelatex')
UserGetter = require('../User/UserGetter')
Settings = require "settings-sharelatex"

module.exports = ReferalFeatures =
	getBonusFeatures: (user_id, callback = (error) ->) ->
		UserGetter.getUserOrUserStubById user_id, null, (error, user) ->
			return callback(error) if error
			return callback(new Error("user not found #{user_id} for assignBonus")) if !user?
			logger.log user_id: user_id, refered_user_count: user.refered_user_count, "assigning bonus"
			if user.refered_user_count? and user.refered_user_count > 0
				newFeatures = ReferalFeatures._calculateFeatures(user)
				callback null, newFeatures
			else
				callback null, {}

	_calculateFeatures : (user)->
		bonusLevel = ReferalFeatures._getBonusLevel(user)
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
