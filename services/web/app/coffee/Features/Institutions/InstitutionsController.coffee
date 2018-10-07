logger = require("logger-sharelatex")
UserGetter = require("../User/UserGetter")
{ addAffiliation } = require("../Institutions/InstitutionsAPI")
async = require('async')

module.exports = InstitutionsController =
	confirmDomain: (req, res, next) ->
		hostname = req.body.hostname
		UserGetter.getUsersByHostname hostname, {_id:1, emails:1}, (error, users) ->
			async.map users, (user, error) ->
				email = user.emails.filter (email) -> email.hostname == hostname
				addAffiliation user._id, email[0].email, {}, (error) =>
					if error?
						logger.err error: error, 'problem adding affiliation while confirming hostname'
						return next(error)
			res.sendStatus 200
