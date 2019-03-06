XRegExp = require('xregexp')

# A note about SAFE_REGEX:
# We have to escape the escape characters because XRegExp compiles it first.
# So it's equivalent to `^[\p{L}\p{N}\s\-_!&\(\)]+$]
# \p{L} = any letter in any language
# \p{N} = any kind of numeric character
# https://www.regular-expressions.info/unicode.html#prop is a good resource for
# more obscure regex features. standard RegExp does not support these

SAFE_REGEX = XRegExp("^[\\p{L}\\p{N}\\s\\-_!&\\(\\)]+$")
EMAIL_REGEX = XRegExp("^[\\p{L}\\p{N}.+_-]+@[\\w.]+$")

SpamSafe = 
	isSafeUserName: (name) ->
		SAFE_REGEX.test(name) && name.length <= 30

	isSafeProjectName: (name) ->
		if XRegExp("\\p{Han}").test(name)
			SAFE_REGEX.test(name) && name.length <= 30
		SAFE_REGEX.test(name) && name.length <= 100

	isSafeEmail: (email) ->
		EMAIL_REGEX.test(email) && email.length <= 40
	
	safeUserName: (name, alternative, project = false) ->
		return name if SpamSafe.isSafeUserName name
		alternative
	
	safeProjectName: (name, alternative) ->
		return name if SpamSafe.isSafeProjectName name
		alternative
	
	safeEmail: (email, alternative) ->
		return email if SpamSafe.isSafeEmail email
		alternative

module.exports = SpamSafe
