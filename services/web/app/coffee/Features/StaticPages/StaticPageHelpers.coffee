extensionsToProxy = [".png", ".xml", ".jpeg", ".json", ".zip", ".eps", ".gif", ".jpg"]
_ = require("underscore")

module.exports =
	shouldProxy: (url)->
		shouldProxy = _.find extensionsToProxy, (extension)->
			url.indexOf(extension) != -1
		return shouldProxy




