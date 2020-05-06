NotFoundError = (message) ->
	error = new Error(message)
	error.name = "NotFoundError"
	error.__proto__ = NotFoundError.prototype
	return error
NotFoundError.prototype.__proto__ = Error.prototype

OpRangeNotAvailableError = (message) ->
	error = new Error(message)
	error.name = "OpRangeNotAvailableError"
	error.__proto__ = OpRangeNotAvailableError.prototype
	return error
OpRangeNotAvailableError.prototype.__proto__ = Error.prototype

ProjectStateChangedError = (message) ->
	error = new Error(message)
	error.name = "ProjectStateChangedError"
	error.__proto__ = ProjectStateChangedError.prototype
	return error
ProjectStateChangedError.prototype.__proto__ = Error.prototype

DeleteMismatchError = (message) ->
	error = new Error(message)
	error.name = "DeleteMismatchError"
	error.__proto__ = DeleteMismatchError.prototype
	return error
DeleteMismatchError.prototype.__proto__ = Error.prototype

module.exports = Errors =
	NotFoundError: NotFoundError
	OpRangeNotAvailableError: OpRangeNotAvailableError
	ProjectStateChangedError: ProjectStateChangedError
	DeleteMismatchError: DeleteMismatchError
