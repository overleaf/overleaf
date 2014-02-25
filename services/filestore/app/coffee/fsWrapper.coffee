settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
s3Wrapper = require("./s3Wrapper")
testWrapper = require("./testWrapper")

module.exports =
	selectBackend: (backend) ->
		wrappedFs = switch backend
			when "s3" then s3Wrapper
			when "test" then testWrapper
			else null

		if !wrappedFs
			throw new Error( "Unknown filestore wrapper #{backend}" )

		module.exports[name] = method for name,method of wrappedFs

if settings.fileStoreWrapper?
	module.exports.selectBackend(settings.fileStoreWrapper)
