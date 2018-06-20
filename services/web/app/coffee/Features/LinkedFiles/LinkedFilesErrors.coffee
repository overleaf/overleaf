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

	handleError: (error, req, res, next) ->
		if error instanceof BadDataError
			res.status(400).send("The submitted data is not valid")

		else if error instanceof AccessDeniedError
			res.status(403).send("You do not have access to this project")

		else if error instanceof BadDataError
			res.status(400).send("The submitted data is not valid")

		else if error instanceof BadEntityTypeError
			res.status(400).send("The file is the wrong type")

		else if error instanceof SourceFileNotFoundError
			res.status(404).send("Source file not found")

		else if error instanceof ProjectNotFoundError
			res.status(404).send("Project not found")

		else if error instanceof V1ProjectNotFoundError
			res.status(409).send("Sorry, the source project is not yet imported to Overleaf v2. Please import it to Overleaf v2 to refresh this file")

		else if error instanceof OutputFileFetchFailedError
			res.status(404).send("Could not get output file")

		else if error instanceof UrlFetchFailedError
			res.status(422).send(
				"Your URL could not be reached (#{error.statusCode} status code). Please check it and try again."
			)

		else if error instanceof InvalidUrlError
			res.status(422).send(
				"Your URL is not valid. Please check it and try again."
			)

		else
			next(error)
}
