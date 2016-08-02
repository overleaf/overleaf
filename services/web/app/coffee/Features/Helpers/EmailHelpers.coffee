mimelib = require("mimelib")


module.exports = EmailHelpers =

	parseEmail: (email) ->
			email = mimelib.parseAddresses(email or "")[0]?.address?.toLowerCase()
			if !email? or email == ""
				return null
			else
				return email
