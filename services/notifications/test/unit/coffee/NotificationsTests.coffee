sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../app/js/Notifications.js"
SandboxedModule = require('sandboxed-module')
assert = require('assert')

user_id = "51dc93e6fb625a261300003b"
notification_key = '123434'

describe 'creating a user', ->
	beforeEach ->
		self = @
		@findOneStub = sinon.stub()
		@findStub = sinon.stub()
		@saveStub = sinon.stub()
		@updateStub = sinon.stub()

		@mongojs = =>
			notifications:
				update: self.mongojsUpdate 
				find: @findStub
				findOne: @findOneStub
				save: @saveStub
				update: @updateStub

		@repository = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': log:->
			'settings-sharelatex': {}
			'mongojs':@mongojs
