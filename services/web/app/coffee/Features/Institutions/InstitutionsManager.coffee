logger = require 'logger-sharelatex'
async = require 'async'
db = require("../../infrastructure/mongojs").db
ObjectId = require("../../infrastructure/mongojs").ObjectId
{ getInstitutionAffiliations } = require('./InstitutionsAPI')
FeaturesUpdater = require('../Subscription/FeaturesUpdater')
UserGetter = require('../User/UserGetter')

ASYNC_LIMIT = 10
module.exports = InstitutionsManager =
	upgradeInstitutionUsers: (institutionId, callback = (error) ->) ->
		getInstitutionAffiliations institutionId, (error, affiliations) ->
			return callback(error) if error
			async.eachLimit affiliations, ASYNC_LIMIT, refreshFeatures, callback
	checkInstitutionUsers: (institutionId, callback = (error) ->) ->
		getInstitutionAffiliations institutionId, (error, affiliations) ->
			UserGetter.getUsersByAnyConfirmedEmail(
				affiliations.map((affiliation) -> affiliation.email),
				{ features: 1 },
				(error, users) -> 
					callback(error, checkFeatures(users))
				)

refreshFeatures = (affiliation, callback) ->
	userId = ObjectId(affiliation.user_id)
	FeaturesUpdater.refreshFeatures(userId, true, callback)

checkFeatures = (users) ->
	usersSummary = {
		totalConfirmedUsers: users.length
		totalConfirmedProUsers: 0
		totalConfirmedNonProUsers: 0
		confirmedNonProUsers: []
	}
	users.forEach((user) -> 
		if user.features.collaborators == -1 and user.features.trackChanges
			usersSummary.totalConfirmedProUsers += 1
		else
			usersSummary.totalConfirmedNonProUsers += 1
			usersSummary.confirmedNonProUsers.push user._id
	)
	return usersSummary