Settings = require "settings-sharelatex"
request = require('request')
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)
Cookie = require('cookie')
logger = require "logger-sharelatex"

buildKey = (project_id)->
	return "clsiserver:#{project_id}"


ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7

module.exports = ClsiCookieManager =

	_getServerId : (project_id, callback = (err, serverId)->)->
		multi = rclient.multi()
		multi.get buildKey(project_id)
		multi.expire buildKey(project_id), ONE_WEEK_IN_SECONDS
		multi.exec (err, results)->
			if err?
				return callback(err)
			serverId = results[0]
			if serverId?
				return callback(null, serverId)
			else
				return ClsiCookieManager._populateServerIdViaRequest project_id, callback


	_populateServerIdViaRequest :(project_id, callback = (err, serverId)->)->
		url = "#{Settings.apis.clsi.url}/project/#{project_id}/status"
		request.get url, (err, res, body)->
			if err?
				logger.err err:err, project_id:project_id, "error getting initial server id for project"
				return callback(err)
			ClsiCookieManager.setServerId project_id, res, (err)->
				if err?
					logger.err err:err, project_id:project_id, "error setting server id via populate request"
				callback(err)

	_parseServerIdFromResponse : (response)->
		cookies = Cookie.parse(response.headers["set-cookie"]?[0] or "")
		return cookies?[Settings.clsiCookieKey]

	setServerId: (project_id, response, callback = ->)->
		serverId = ClsiCookieManager._parseServerIdFromResponse(response)
		multi = rclient.multi()
		multi.set buildKey(project_id), serverId
		multi.expire buildKey(project_id), ONE_WEEK_IN_SECONDS
		multi.exec callback


	getCookieJar: (project_id, callback = (err, jar)->)->
		ClsiCookieManager._getServerId project_id, (err, serverId)=>
			if err?
				logger.err err:err, project_id:project_id, "error getting server id"
				return callback(err)
			serverCookie = request.cookie("clsiserver=#{serverId}")
			jar = request.jar()
			jar.setCookie serverCookie, Settings.apis.clsi.url
			callback(null, jar)


