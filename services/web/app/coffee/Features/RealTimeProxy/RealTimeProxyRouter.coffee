settings = require "settings-sharelatex"

httpProxy = require('http-proxy');
proxy = httpProxy.createProxyServer({
	target: settings.apis.realTime.url
})
wsProxy = httpProxy.createProxyServer({
	target: settings.apis.realTime.url.replace("http://", "ws://")
	ws: true
})

module.exports =
	apply: (app) ->
		app.all /\/socket\.io\/.*/, (req, res, next) ->
			proxy.web req, res, next
			
		setTimeout () ->
			Server = require "../../infrastructure/Server"
			Server.server.on "upgrade", (req, socket, head) ->
				wsProxy.ws req, socket, head
		, 0