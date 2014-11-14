sinon = require('sinon')

idCounter = 0

module.exports = class MockClient
	constructor: () ->
		@attributes = {}
		@join = sinon.stub()
		@emit = sinon.stub()
		@disconnect = sinon.stub()
		@id = idCounter++
	set : (key, value, callback) ->
		@attributes[key] = value
		callback() if callback?
	get : (key, callback) ->
		callback null, @attributes[key]
	disconnect: () ->
