crypto = require "crypto"

module.exports = UserFormatter =
	formatUserForClientSide: (user) ->
		return null if !user?
		if user._id?
			user.id = user._id.toString()
			delete user._id
		return {
			id: user.id
			first_name: user.first_name
			last_name: user.last_name
			email: user.email
			gravatar_url: @_getGravatarUrlForEmail(user.email)
		}

	_getGravatarUrlForEmail: (email) ->
		hash = crypto.createHash("md5").update(email.toLowerCase()).digest("hex")
		return "//www.gravatar.com/avatar/#{hash}"
