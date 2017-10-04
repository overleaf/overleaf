module.exports = ProjectTokenGenerator =


	readOnlyToken: () ->
		length = 12
		tokenAlpha = 'bcdfghjkmnpqrstvwxyz'
		result = ''
		for _n in [1..length]
			i = Math.floor(Math.floor(Math.random() * tokenAlpha.length))
			result += tokenAlpha[i]
		return result

	readAndWriteToken: () ->
		numerics = Math.random().toString().slice(2, 12)
		token = ProjectTokenGenerator.readOnlyToken()
		return "#{numerics}#{token}"
