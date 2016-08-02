mimelib = require("mimelib")


module.exports = EmailHelper =

	parseEmail: (email) ->
			email = mimelib.parseAddresses(email or "")[0]?.address?.toLowerCase()
			if !email? or email == ""
				return null
			else
				return email
