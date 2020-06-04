XMLHttpRequest = require("../../libs/XMLHttpRequest").XMLHttpRequest
io = require("socket.io-client")

request = require "request"
Settings = require "settings-sharelatex"
redis = require "redis-sharelatex"
rclient = redis.createClient(Settings.redis.websessions)

uid = require('uid-safe').sync
signature = require("cookie-signature")

io.util.request = () ->
	xhr = new XMLHttpRequest()
	_open = xhr.open
	xhr.open = () =>
		_open.apply(xhr, arguments)
		if Client.cookie?
			xhr.setRequestHeader("Cookie", Client.cookie)
	return xhr

module.exports = Client =
	cookie: null

	setSession: (session, callback = (error) ->) ->
		sessionId = uid(24)
		session.cookie = {}
		rclient.set "sess:" + sessionId, JSON.stringify(session), (error) ->
			return callback(error) if error?
			secret = Settings.security.sessionSecret
			cookieKey = 's:' + signature.sign(sessionId, secret)
			Client.cookie = "#{Settings.cookieName}=#{cookieKey}"
			callback()
			
	unsetSession: (callback = (error) ->) ->
		Client.cookie = null
		callback()
			
	connect: (cookie) ->
		client = io.connect("http://localhost:3026", 'force new connection': true)
		client.on 'connectionAccepted', (_, publicId) ->
			client.publicId = publicId
		return client
		
	getConnectedClients: (callback = (error, clients) ->) ->
		request.get {
			url: "http://localhost:3026/clients"
			json: true
		}, (error, response, data) ->
			callback error, data
		
	getConnectedClient: (client_id, callback = (error, clients) ->) ->
		request.get {
			url: "http://localhost:3026/clients/#{client_id}"
			json: true
		}, (error, response, data) ->
			callback error, data

