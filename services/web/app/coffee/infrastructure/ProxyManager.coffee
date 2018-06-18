settings = require("settings-sharelatex")
logger = require("logger-sharelatex")
httpProxy = require 'express-http-proxy'

module.exports = 
	# add proxy for all paths listed in `settings.proxyUrls`and log errors
	apply: (app) ->
		for requestUrl, target of settings.proxyUrls
			targetUrl = @makeTargetUrl(target)
			if targetUrl?
				app.use requestUrl, httpProxy(targetUrl)
			else
				logger.error "Cannot make proxy target from #{target}"

	# takes a 'target' and return an URL to proxy to.
	# 'target' can be:
	# - a String, representing the URL
	# - an Object with:
	#   - a path attribute (String)
	#   - a baseURL attribute (String)
	#   - a baseURL attribute (Object) with:
	#     - a setting attribute pointing to a value in the settings
	makeTargetUrl: (target) ->
		return target if typeof target is 'string'
		return target.path unless target.baseUrl?

		if typeof target.baseUrl is 'string'
			baseUrl = target.baseUrl
		else if target.baseUrl.setting?
			baseUrl = digSettingValue target.baseUrl.setting

		return null unless baseUrl?
		"#{baseUrl}#{target.path}"

# given a setting path (e.g. 'apis.v1.url') recursively find the corresponding
# settings value
digSettingValue = (attributesPath, dig = null) ->
	dig ||= settings
	[nextAttribute, leftAttributes...] = attributesPath.split('.')
	dig = dig[nextAttribute]
	return null unless dig?
	return dig if leftAttributes.length == 0
	digSettingValue(leftAttributes.join('.'), dig)
