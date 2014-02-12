SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Referal/ReferalHandler.js'

describe 'Referal handler', ->

	beforeEach ->
		@User = findById:sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			'logger-sharelatex':
				log:->
				err:->
			'../../models/User': User:@User


	describe 'getting refered user_ids', ->
		user_id = "12313"

		it 'should get the user from mongo and return the refered users array', (done)->
			user = 
				refered_users : ["1234", "312312", "3213129"]
			@User.findById.callsArgWith(1, null, user)
			@handler.getReferedUserIds user_id, (err, passedReferedUserIds)->
				passedReferedUserIds.should.deep.equal user.refered_users
				done()

		it 'should return an empty array if it is not set', (done)->
			user = {}
			@User.findById.callsArgWith(1, null, user)
			@handler.getReferedUserIds user_id, (err, passedReferedUserIds)->
				passedReferedUserIds.length.should.equal 0
				done()

