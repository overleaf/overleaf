logger = require("logger-sharelatex")
UserGetter = require("../User/UserGetter")
{ addAffiliation } = require("../Institutions/InstitutionsAPI")
async = require('async')

module.exports = InstitutionsController =
	confirmDomain: (req, res, next) ->
		hostname = req.body.hostname.split('').reverse().join('')
		UserGetter.getUsersByHostname hostname, {_id:1, emails:1}, (error, users) ->
			if error?
				logger.err error: error, 'problem fetching users by hostname'
				return next(error)
			async.map users, ((user) ->
				matchingEmails = user.emails.filter (email) -> email.hostname == hostname
				for email in matchingEmails
					addAffiliation user._id, email.email, {confirmedAt: email.confirmedAt}, (error) =>
						if error?
							logger.err error: error, 'problem adding affiliation while confirming hostname'
							return next(error)
				), (error) ->
					if error?
						return next(error)
			res.sendStatus 200
