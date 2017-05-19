Settings = require "settings-sharelatex"
request = require('request')
RedisWrapper = require("../../infrastructure/RedisWrapper")
rclient = RedisWrapper.client("clsi_cookie")
if Settings.redis.clsi_cookie_secondary?
	rclient_secondary = RedisWrapper.client("clsi_cookie_secondary")
Cookie = require('cookie')
logger = require "logger-sharelatex"

buildKey = (project_id)->
	return "clsiserver:#{project_id}"

clsiCookiesEnabled = Settings.clsiCookie?.key? and Settings.clsiCookie.key.length != 0


module.exports = ClsiCookieManager =

	_getServerId : (project_id, callback = (err, serverId)->)->
		rclient.get buildKey(project_id), (err, serverId)->
			if err?
				return callback(err)
			if !serverId? or serverId == ""
				return ClsiCookieManager._populateServerIdViaRequest project_id, callback
			else
				return callback(null, serverId)


	_populateServerIdViaRequest :(project_id, callback = (err, serverId)->)->
		url = "#{Settings.apis.clsi.url}/project/#{project_id}/status"
		request.get url, (err, res, body)->
			if err?
				logger.err err:err, project_id:project_id, "error getting initial server id for project"
				return callback(err)
			ClsiCookieManager.setServerId project_id, res, (err, serverId)->
				if err?
					logger.err err:err, project_id:project_id, "error setting server id via populate request"
				callback(err, serverId)

	_parseServerIdFromResponse : (response)->
		cookies = Cookie.parse(response.headers["set-cookie"]?[0] or "")
		return cookies?[Settings.clsiCookie.key]

	setServerId: (project_id, response, callback = (err, serverId)->)->
		if !clsiCookiesEnabled
			return callback()
		serverId = ClsiCookieManager._parseServerIdFromResponse(response)
		if !serverId? # We don't get a cookie back if it hasn't changed
			return callback()
		if rclient_secondary?
			@_setServerIdInRedis rclient_secondary, project_id, serverId
		@_setServerIdInRedis rclient, project_id, serverId, (err) ->
			callback(err, serverId)

	_setServerIdInRedis: (rclient, project_id, serverId, callback = (err) ->) ->
		multi = rclient.multi()
		multi.set buildKey(project_id), serverId
		multi.expire buildKey(project_id), Settings.clsiCookie.ttl
		multi.exec callback

	clearServerId: (project_id, callback = (err)->)->
		if !clsiCookiesEnabled
			return callback()
		rclient.del buildKey(project_id), callback

	getCookieJar: (project_id, callback = (err, jar)->)->
		if !clsiCookiesEnabled
			return callback(null, request.jar())
		ClsiCookieManager._getServerId project_id, (err, serverId)=>
			if err?
				logger.err err:err, project_id:project_id, "error getting server id"
				return callback(err)
			serverCookie = request.cookie("#{Settings.clsiCookie.key}=#{serverId}")
			jar = request.jar()
			jar.setCookie serverCookie, Settings.apis.clsi.url
			callback(null, jar)


