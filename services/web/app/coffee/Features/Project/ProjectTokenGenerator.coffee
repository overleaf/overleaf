crypto = require 'crypto'

module.exports = ProjectTokenGenerator =

	readOnlyToken: () ->
		length = 12
		tokenAlpha = 'bcdfghjkmnpqrstvwxyz'
		result = ''
		crypto.randomBytes(length).map( (a) -> result += tokenAlpha[a % tokenAlpha.length] )
		return result

	readAndWriteToken: () ->
		numerics = Math.random().toString().slice(2, 12)
		token = ProjectTokenGenerator.readOnlyToken()
		return "#{numerics}#{token}"
