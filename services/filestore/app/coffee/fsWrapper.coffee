settings = require("settings-sharelatex")
wrappedFs = switch settings.filestoreWrapper
	when "s3" then require("./s3Wrapper")
	else null

if !wrappedFs
	throw new Error( "Unknown filestore wrapper #{settings.filestoreWrapper}" )

module.exports[name] = method for name,method of wrappedFs
