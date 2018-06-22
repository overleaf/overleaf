UrlFetchFailedError = (message) ->
	error = new Error(message)
	error.name = 'UrlFetchFailedError'
	error.__proto__ = UrlFetchFailedError.prototype
	return error
UrlFetchFailedError.prototype.__proto__ = Error.prototype


InvalidUrlError = (message) ->
	error = new Error(message)
	error.name = 'InvalidUrlError'
	error.__proto__ = InvalidUrlError.prototype
	return error
InvalidUrlError.prototype.__proto__ = Error.prototype


OutputFileFetchFailedError = (message) ->
	error = new Error(message)
	error.name = 'OutputFileFetchFailedError'
	error.__proto__ = OutputFileFetchFailedError.prototype
	return error
OutputFileFetchFailedError.prototype.__proto__ = Error.prototype


AccessDeniedError = (message) ->
	error = new Error(message)
	error.name = 'AccessDenied'
	error.__proto__ = AccessDeniedError.prototype
	return error
AccessDeniedError.prototype.__proto__ = Error.prototype


BadEntityTypeError = (message) ->
	error = new Error(message)
	error.name = 'BadEntityType'
	error.__proto__ = BadEntityTypeError.prototype
	return error
BadEntityTypeError.prototype.__proto__ = Error.prototype


BadDataError = (message) ->
	error = new Error(message)
	error.name = 'BadData'
	error.__proto__ = BadDataError.prototype
	return error
BadDataError.prototype.__proto__ = Error.prototype


ProjectNotFoundError = (message) ->
	error = new Error(message)
	error.name = 'ProjectNotFound'
	error.__proto__ = ProjectNotFoundError.prototype
	return error
ProjectNotFoundError.prototype.__proto__ = Error.prototype


V1ProjectNotFoundError = (message) ->
	error = new Error(message)
	error.name = 'V1ProjectNotFound'
	error.__proto__ = V1ProjectNotFoundError.prototype
	return error
V1ProjectNotFoundError.prototype.__proto__ = Error.prototype


SourceFileNotFoundError = (message) ->
	error = new Error(message)
	error.name = 'SourceFileNotFound'
	error.__proto__ = SourceFileNotFoundError.prototype
	return error
SourceFileNotFoundError.prototype.__proto__ = Error.prototype


module.exports = {

	UrlFetchFailedError,
	InvalidUrlError,
	OutputFileFetchFailedError,
	AccessDeniedError,
	BadEntityTypeError,
	BadDataError,
	ProjectNotFoundError,
	V1ProjectNotFoundError,
	SourceFileNotFoundError,
}
