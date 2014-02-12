sinon = require "sinon"

class MockResponse
	constructor: ->
		@rendered = false
		@redirected = false
		@returned = false
		@headers = {}

	render: (template, variables) ->
		@success = true
		@rendered = true
		@returned = true
		@renderedTemplate  = template
		@renderedVariables = variables
		@callback() if @callback?
	
	redirect: (url) ->
		@success = true
		@redirected = true
		@returned = true
		@redirectedTo = url
		@callback() if @callback?
	
	send: (status, body) ->
		if arguments.length < 2
			if typeof status != "number"
				body = status
				status = 200
		@statusCode = status
		@returned = true
		if 200 <= status < 300
			@success = true
		else
			@success = false
		@body = body if body
		@callback() if @callback?

	setHeader: (header, value) ->
		@headers[header] = value

	header: sinon.stub()

	contentType: sinon.stub()

	end: (data, encoding) ->
		@callback() if @callback

	type: (type) -> @type = type

module.exports = MockResponse
