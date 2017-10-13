crypto = require 'crypto'

# This module mirrors the token generation in Overleaf (`random_token.rb`),
# for the purposes of implementing token-based project access, like the
# 'unlisted-projects' feature in Overleaf

module.exports = ProjectTokenGenerator =

	# (From Overleaf `random_token.rb`)
  #   Letters (not numbers! see generate_token) used in tokens. They're all
  #   consonsants, to avoid embarassing words (I can't think of any that use only
  #   a y), and lower case "l" is omitted, because in many fonts it is
  #   indistinguishable from an upper case "I" (and sometimes even the number 1).
	TOKEN_ALPHA: 'bcdfghjkmnpqrstvwxyz'

	# Generate a 12-char token with only characters from TOKEN_ALPHA,
	# suitable for use as a read-only token for a project
	readOnlyToken: () ->
		length = 12
		tokenAlpha = ProjectTokenGenerator.TOKEN_ALPHA
		result = ''
		crypto.randomBytes(length).map( (a) -> result += tokenAlpha[a % tokenAlpha.length] )
		return result

	# Generate a longer token, with a numeric prefix,
	# suitable for use as a read-and-write token for a project
	readAndWriteToken: () ->
		numerics = Math.random().toString().slice(2, 12)
		token = ProjectTokenGenerator.readOnlyToken()
		return "#{numerics}#{token}"
