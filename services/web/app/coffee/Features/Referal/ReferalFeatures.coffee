_ = require("underscore")
logger = require('logger-sharelatex')
User = require('../../models/User').User
Settings = require "settings-sharelatex"

module.exports = ReferalFeatures =
	getBonusFeatures: (user_id, callback = (error) ->) ->
		query = _id: user_id
		User.findOne query, (error, user) ->
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
		return Settings.bonus_features?["#{bonusLevel}"] or {}

	_getBonusLevel: (user)->
		highestBonusLevel = 0
		_.each _.keys(Settings.bonus_features), (level)->
			levelIsLessThanUser = level <= user.refered_user_count
			levelIsMoreThanCurrentHighest = level >= highestBonusLevel
			if levelIsLessThanUser and levelIsMoreThanCurrentHighest
				highestBonusLevel = level
		return highestBonusLevel
