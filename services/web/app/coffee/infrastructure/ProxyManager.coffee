settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
request = require 'request'
URL = require 'url'

module.exports = ProxyManager =
	call: (req, res, next) ->
		requestUrl = URL.parse(req.url)
		requestPath = requestUrl.pathname # ignore the query part

		target = settings.proxyUrls[requestPath]
		return next() unless target? # nothing to proxy

		targetUrl = makeTargetUrl(target, req.query)
		logger.log targetUrl: targetUrl, reqUrl: req.url, "proxying url"

		upstream = request(targetUrl)
		upstream.on "error", (error) ->
			logger.error err: error, "error in ProxyManager"

		# TODO: better handling of status code
		# see https://github.com/overleaf/write_latex/wiki/Streams-and-pipes-in-Node.js
		upstream.pipe(res)

# make a URL from a proxy target.
# if the query is specified, set/replace the target's query with the given query
makeTargetUrl = (target, query) ->
	targetUrl = URL.parse(parseSettingUrl(target))
	if query? and Object.keys(query).length > 0
		targetUrl.query = query
		targetUrl.search = null # clear `search` as it takes precedence over `query`
	targetUrl.format()

parseSettingUrl = (target) ->
	return target if typeof target is 'string'
	"#{target.baseUrl}#{target.path or ''}"
