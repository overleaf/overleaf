settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
request = require 'request'
URL = require 'url'

module.exports = ProxyManager =
	apply: (publicApiRouter) ->
		for proxyUrl, target of settings.proxyUrls
			do (target) ->
				method = target.options?.method || 'get'
				publicApiRouter[method] proxyUrl, ProxyManager.createProxy(target)

	createProxy:  (target) ->
		(req, res, next) ->
			targetUrl = makeTargetUrl(target, req)
			logger.log targetUrl: targetUrl, reqUrl: req.url, "proxying url"

			options =
				url: targetUrl
			options.headers = { Cookie: req.headers.cookie } if req.headers?.cookie
			Object.assign(options, target.options) if target?.options?
			options.form = req.body if options.method in ['post', 'put']
			upstream = request(options)
			upstream.on "error", (error) ->
				logger.error err: error, "error in ProxyManager"

			# TODO: better handling of status code
			# see https://github.com/overleaf/write_latex/wiki/Streams-and-pipes-in-Node.js
			upstream.pipe(res)

# make a URL from a proxy target.
# if the query is specified, set/replace the target's query with the given query
makeTargetUrl = (target, req) ->
	targetUrl = URL.parse(parseSettingUrl(target, req))
	if req.query? and Object.keys(req.query).length > 0
		targetUrl.query = req.query
		targetUrl.search = null # clear `search` as it takes precedence over `query`
	targetUrl.format()

parseSettingUrl = (target, { params }) ->
	return target if typeof target is 'string'
	if typeof target.path is 'function'
		path = target.path(params)
	else
		path = target.path
	"#{target.baseUrl}#{path or ''}"
