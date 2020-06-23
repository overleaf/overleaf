CodedError = (message, code) ->
	error = new Error(message)
	error.name = "CodedError"
	error.code = code
	error.__proto__ = CodedError.prototype
	return error
CodedError.prototype.__proto__ = Error.prototype

module.exports = Errors =
	CodedError: CodedError
