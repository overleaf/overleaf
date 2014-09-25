module.exports =

	createClient: ()->
		if arguments[0] instanceof Array
			client = require("redis-sentinel").createClient.apply null, arguments
		else
			client = require("redis").createClient.apply null, arguments
		return client


