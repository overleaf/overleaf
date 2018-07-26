logger = require 'logger-sharelatex'
async = require 'async'
db = require("../../infrastructure/mongojs").db
ObjectId = require("../../infrastructure/mongojs").ObjectId
{ getInstitutionAffiliations } = require('./InstitutionsAPI')
FeaturesUpdater = require('../Subscription/FeaturesUpdater')

ASYNC_LIMIT = 10
module.exports = InstitutionsManager =
	upgradeInstitutionUsers: (institutionId, callback = (error) ->) ->
		getInstitutionAffiliations institutionId, (error, affiliations) ->
			return callback(error) if error
			async.eachLimit affiliations, ASYNC_LIMIT, refreshFeatures, callback

refreshFeatures = (affiliation, callback) ->
	userId = ObjectId(affiliation.user_id)
	FeaturesUpdater.refreshFeatures(userId, true, callback)
