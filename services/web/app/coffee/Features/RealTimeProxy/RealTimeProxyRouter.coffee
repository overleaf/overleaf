settings = require "settings-sharelatex"

httpProxy = require('http-proxy');
proxy = httpProxy.createProxyServer({
	target: settings.apis.realTime.url
	ws: true
})

module.exports =
	apply: (app) ->
		app.all /\/socket\.io\/.*/, (req, res, next) ->
			proxy.web req, res, next