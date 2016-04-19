Settings = require "settings-sharelatex"
request = require('request')
redis = require("redis-sharelatex")
rclient = redis.createClient(Settings.redis.web)
cookie = require('cookie')

buildKey = (project_id)->
	return "clsiserver:#{project_id}"


ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7

module.exports = ClsiRequestManager =

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
				return ClsiRequestManager._getServerIdViaRequest project_id, callback


	_getServerIdViaRequest :(project_id, callback = (err, serverId)->)->
		url = "#{Settings.apis.clsi.url}/project/#{project_id}/status"
		request.get url, (err, res, body)->
			if err?
				logger.err err:err, project_id:project_id, "error getting initial server id for project"
				return callback(err)
			ClsiRequestManager.setServerId project_id, res, callback

	_parseServerIdFromResponse : (response)->
		console.log response.headers
		cookies = cookie.parse(response.headers["set-cookie"]?[0] or "")
		return cookies?.clsiserver

	setServerId: (project_id, response, callback = ->)->
		serverId = ClsiRequestManager._parseServerIdFromResponse(response)
		multi = rclient.multi()
		multi.set buildKey(project_id), serverId
		multi.expire buildKey(project_id), ONE_WEEK_IN_SECONDS
		multi.exec callback


	getCookieJar: (project_id, opts, callback = (err, jar)->)->
		ClsiRequestManager._getServerId project_id, (err, serverId)=>
			if err?
				logger.err err:err, project_id:project_id, "error getting server id"
				return callback(err)
			cookie = request.cookie("clsiserver=#{serverId}")
			jar = request.jar()
			jar.setCookie cookie, Settings.apis.clsi.url
			callback(null, jar)


