UserGetter = require '../User/UserGetter'
logger = require 'logger-sharelatex'

module.exports = InstitutionsGetter =
	getConfirmedInstitutions: (userId, callback = (error, institutions) ->) ->
		UserGetter.getUserFullEmails userId, (error, emailsData) ->
			return callback error if error?

			confirmedInstitutions = emailsData.filter (emailData) -> 
				emailData.confirmedAt? and emailData.affiliation?.institution?
			.map (emailData) ->
				emailData.affiliation?.institution

			callback(null, confirmedInstitutions)
