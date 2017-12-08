NotFoundError = (message) ->
	error = new Error(message)
	error.name = "NotFoundError"
	error.__proto__ = NotFoundError.prototype
	return error
NotFoundError.prototype.__proto__ = Error.prototype

ServiceNotConfiguredError = (message) ->
	error = new Error(message)
	error.name = "ServiceNotConfiguredError"
	error.__proto__ = ServiceNotConfiguredError.prototype
	return error
ServiceNotConfiguredError.prototype.__proto__ = Error.prototype

TooManyRequestsError = (message) ->
	error = new Error(message)
	error.name = "TooManyRequestsError"
	error.__proto__ = TooManyRequestsError.prototype
	return error
TooManyRequestsError.prototype.__proto__ = Error.prototype

InvalidNameError = (message) ->
	error = new Error(message)
	error.name = "InvalidNameError"
	error.__proto__ = InvalidNameError.prototype
	return error
InvalidNameError.prototype.__proto__ = Error.prototype

UnsupportedFileType = (message) ->
	error = new Error(message)
	error.name = "UnsupportedFileType"
	error.__proto__ = UnsupportedFileType.prototype
	return error
UnsupportedFileType.prototype.__proto___ = Error.prototype

module.exports = Errors =
	NotFoundError: NotFoundError
	ServiceNotConfiguredError: ServiceNotConfiguredError
	TooManyRequestsError: TooManyRequestsError
	InvalidNameError: InvalidNameError
	UnsupportedFileType: UnsupportedFileType
