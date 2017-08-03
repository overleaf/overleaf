NotFoundError = (message) ->
	error = new Error(message)
	error.name = "NotFoundError"
	error.__proto__ = NotFoundError.prototype
	return error
NotFoundError.prototype.__proto__ = Error.prototype

FilesOutOfSyncError = (message) ->
	error = new Error(message)
	error.name = "FilesOutOfSyncError"
	error.__proto__ = FilesOutOfSyncError.prototype
	return error
FilesOutOfSyncError.prototype.__proto__ = Error.prototype

module.exports = Errors =
	NotFoundError: NotFoundError
	FilesOutOfSyncError: FilesOutOfSyncError
