crypto = require 'crypto'

# This module mirrors the token generation in Overleaf (`random_token.rb`),
# for the purposes of implementing token-based project access, like the
# 'unlisted-projects' feature in Overleaf

module.exports = ProjectTokenGenerator =

	# (From Overleaf `random_token.rb`)
  #   Letters (not numbers! see generate_token) used in tokens. They're all
  #   consonants, to avoid embarassing words (I can't think of any that use only
  #   a y), and lower case "l" is omitted, because in many fonts it is
  #   indistinguishable from an upper case "I" (and sometimes even the number 1).
	TOKEN_ALPHA: 'bcdfghjkmnpqrstvwxyz'
	TOKEN_NUMERICS: '123456789'

	_randomString: (length, alphabet) ->
		result = crypto.randomBytes(length).toJSON().data.map(
			(b) -> alphabet[b % alphabet.length]
		).join('')
		return result

	# Generate a 12-char token with only characters from TOKEN_ALPHA,
	# suitable for use as a read-only token for a project
	readOnlyToken: () ->
		return ProjectTokenGenerator._randomString(
			12,
			ProjectTokenGenerator.TOKEN_ALPHA
		)

	# Generate a longer token, with a numeric prefix,
	# suitable for use as a read-and-write token for a project
	readAndWriteToken: () ->
		numerics = ProjectTokenGenerator._randomString(
			10,
			ProjectTokenGenerator.TOKEN_NUMERICS
		)
		token = ProjectTokenGenerator._randomString(
			12,
			ProjectTokenGenerator.TOKEN_ALPHA
		)
		fullToken = "#{numerics}#{token}"
		return fullToken
