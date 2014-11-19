_ = require("underscore")

module.exports = RedisSharelatex =
	createClient: (opts = {port: 6379, host: "localhost"})->
		if !opts.retry_max_delay?
			opts.retry_max_delay = 5000 # ms
		
		if opts.password?
			opts.auth_pass = opts.password
			delete opts.password
		if opts.endpoints?
			standardOpts = _.clone(opts)
			delete standardOpts.endpoints
			delete standardOpts.masterName
			client = require("redis-sentinel").createClient opts.endpoints, opts.masterName, standardOpts
		else
			standardOpts = _.clone(opts)
			delete standardOpts.port
			delete standardOpts.host
			client = require("redis").createClient opts.port, opts.host, standardOpts
		return client