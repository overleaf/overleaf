EMAIL_REGEXP = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\ ".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA -Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

module.exports = EmailHelper =

	parseEmail: (email) ->
		return null unless email?
		return null if email.length > 254
		email = email.trim().toLowerCase()

		matched = email.match EMAIL_REGEXP
		return null unless matched? && matched[0]?

		matched[0]
