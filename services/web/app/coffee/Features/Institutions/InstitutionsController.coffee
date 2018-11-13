logger = require("logger-sharelatex")
UserGetter = require("../User/UserGetter")
{ addAffiliation } = require("../Institutions/InstitutionsAPI")
Institution = require('../../models/Institution').Institution
async = require('async')

module.exports = InstitutionsController =
	confirmDomain: (req, res, next) ->
		hostname = req.body.hostname
		institutionId = req.body.institution_id
		createInstitution institutionId, (error) ->
			return next(error) if error?
			affiliateUsers hostname, (error) ->
				return next(error) if error?
				res.sendStatus 200

createInstitution = (institutionId, callback = (error)->) ->
	data = v1Id: institutionId
	Institution.findOneAndUpdate data, data, { upsert: true }, callback

affiliateUsers = (hostname, callback = (error)->) ->
	reversedHostname = hostname.trim().split('').reverse().join('')
	UserGetter.getUsersByHostname hostname, {_id:1, emails:1}, (error, users) ->
		if error?
			logger.err error: error, 'problem fetching users by hostname'
			return callback(error)

		async.map users, ((user, innerCallback) ->
			affiliateUserByReversedHostname user, reversedHostname, innerCallback
		), callback

affiliateUserByReversedHostname = (user, reversedHostname, callback) ->
	matchingEmails = user.emails.filter (email) -> email.reversedHostname == reversedHostname
	async.map matchingEmails, ((email, innerCallback) ->
		addAffiliation user._id, email.email, {confirmedAt: email.confirmedAt}, (error) =>
			if error?
				logger.err error: error, 'problem adding affiliation while confirming hostname'
				return innerCallback(error)
			innerCallback()
	), callback
