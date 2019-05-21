logger = require 'logger-sharelatex'
async = require 'async'
db = require("../../infrastructure/mongojs").db
_ = require("underscore")
ObjectId = require("../../infrastructure/mongojs").ObjectId
{ getInstitutionAffiliations } = require('./InstitutionsAPI')
FeaturesUpdater = require('../Subscription/FeaturesUpdater')
UserGetter = require('../User/UserGetter')
NotificationsBuilder = require("../Notifications/NotificationsBuilder")
SubscriptionLocator = require("../Subscription/SubscriptionLocator")
Institution = require("../../models/Institution").Institution
Subscription = require("../../models/Subscription").Subscription

ASYNC_LIMIT = 10
module.exports = InstitutionsManager =
	upgradeInstitutionUsers: (institutionId, callback = (error) ->) ->
		async.waterfall [
			(cb) ->
				fetchInstitutionAndAffiliations institutionId, cb
			(institution, affiliations, cb) ->
				affiliations = _.map affiliations, (affiliation) ->
					affiliation.institutionName = institution.name
					affiliation.institutionId = institutionId
					return affiliation
				async.eachLimit affiliations, ASYNC_LIMIT, refreshFeatures, (err) -> cb(err)
		], callback

	checkInstitutionUsers: (institutionId, callback = (error) ->) ->
		getInstitutionAffiliations institutionId, (error, affiliations) ->
			UserGetter.getUsersByAnyConfirmedEmail(
				affiliations.map((affiliation) -> affiliation.email),
				{ features: 1 },
				(error, users) -> 
					callback(error, checkFeatures(users))
				)

	getInstitutionUsersSubscriptions: (institutionId, callback = (error, subscriptions) ->) ->
		getInstitutionAffiliations institutionId, (error, affiliations) ->
			return callback(error) if error?
			userIds = affiliations.map (affiliation) -> ObjectId(affiliation.user_id)
			Subscription
				.find admin_id: userIds, planCode: { $not: /trial/ }
				.populate 'admin_id', 'email'
				.exec callback

fetchInstitutionAndAffiliations = (institutionId, callback) ->
	async.waterfall [
		(cb) ->
			Institution.findOne {v1Id: institutionId}, (err, institution) -> cb(err, institution)
		(institution, cb) ->
			institution.fetchV1Data  (err, institution) -> cb(err, institution)
		(institution, cb) ->
			getInstitutionAffiliations institutionId, (err, affiliations) -> cb(err, institution, affiliations)
	], callback

refreshFeatures = (affiliation, callback) ->
	userId = ObjectId(affiliation.user_id)
	async.waterfall [
		(cb) ->
			FeaturesUpdater.refreshFeatures userId, true, (err, features, featuresChanged) -> cb(err, featuresChanged)
		(featuresChanged, cb) ->
			getUserInfo userId, (error, user, subscription) -> cb(error, user, subscription, featuresChanged)
		(user, subscription, featuresChanged, cb) ->
			notifyUser user, affiliation, subscription, featuresChanged, cb
	], callback

getUserInfo = (userId, callback) ->
	async.waterfall [
		(cb) ->
			UserGetter.getUser userId, cb
		(user, cb) ->
			SubscriptionLocator.getUsersSubscription user, (err, subscription) -> cb(err, user, subscription)
	], callback

notifyUser = (user, affiliation, subscription, featuresChanged, callback) ->
	async.parallel [
		(cb) ->
			if featuresChanged
				NotificationsBuilder.featuresUpgradedByAffiliation(affiliation, user).create cb
			else
				cb()
		(cb) ->
			if subscription? and !subscription.planCode.match(/(free|trial)/)? and !subscription.groupPlan
				NotificationsBuilder.redundantPersonalSubscription(affiliation, user).create cb
			else
				cb()
		], callback

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
