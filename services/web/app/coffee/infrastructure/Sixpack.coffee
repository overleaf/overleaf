settings = require("settings-sharelatex")
request = require("request")
logger = require("logger-sharelatex")

generate_client_id = ->
	# from http://stackoverflow.com/questions/105034
	'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace /[xy]/g, (c) ->
		r = Math.random() * 16 | 0
		v = if c == 'x' then r else r & 0x3 | 0x8
		v.toString 16

_request_uri = (endpoint, params) ->
	query_string = []
	e = encodeURIComponent
	for key of params
		if params.hasOwnProperty(key)
			vals = params[key]
			if Object::toString.call(vals) != '[object Array]'
				vals = [ vals ]
			i = 0
			while i < vals.length
				query_string.push e(key) + '=' + e(vals[i])
				i += 1
	if query_string.length
		endpoint += '?' + query_string.join('&')
	endpoint

_request = (uri, params, callback)->
	opts =
		uri:_request_uri(uri, params)
		json:true
		timeout:1000
	request.get opts, (err, res, body)->
		callback err, body

module.exports = sixpack =

	client: (user_id)->
		client = new sixpack.Session(user_id, settings.apis.sixpack.url)
		return client

	Session : (client_id, base_url, ip_address, user_agent) ->

		@client_id = client_id or sixpack.generate_client_id()
		@base_url = base_url or sixpack.base_url

		participate: (experiment_name, alternatives, force, callback) =>
			if typeof force == 'function'
				callback = force
				force = null
			if !/^[a-z0-9][a-z0-9\-_ ]*$/.test(experiment_name)
				return callback(new Error('Bad experiment_name'))
			if alternatives.length < 2
				return callback(new Error('Must specify at least 2 alternatives'))
			i = 0
			while i < alternatives.length
				if !/^[a-z0-9][a-z0-9\-_ ]*$/.test(alternatives[i])
					return callback(new Error('Bad alternative name: ' + alternatives[i]))
				i += 1
			params = 
				client_id: @client_id
				experiment: experiment_name
				alternatives: alternatives

			if force != null and _in_array(alternatives, force)
				return callback(null,
					'status': 'ok'
					'alternative': 'name': force
					'experiment':
						'version': 0
						'name': experiment_name
					'client_id': @client_id)

			_request @base_url + '/participate', params, (err, res) ->
				if err?
					res =
						status: 'failed'
						error: err
						alternative: name: alternatives[0]
				callback null, res

		convert: (experiment_name, callback)=>
			if !/^[a-z0-9][a-z0-9\-_ ]*$/.test(experiment_name)
				return callback(new Error('Bad experiment_name'))
			params = 
				client_id: @client_id
				experiment: experiment_name
			if @ip_address
				params.ip_address = @ip_address
			if @user_agent
				params.user_agent = @user_agent
			_request @base_url + '/convert', params, (err, res) ->
				if err?
					res =
						status: 'failed'
						error: err
				callback null, res


