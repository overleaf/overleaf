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
		@user_id = "12313"


	describe 'getting refered user_ids', ->
		it 'should get the user from mongo and return the refered users array', (done)->
			user =
				refered_users : ["1234", "312312", "3213129"]
				refered_user_count : 3
			@User.findById.callsArgWith(1, null, user)

			@handler.getReferedUsers @user_id, (err, passedReferedUserIds, passedReferedUserCount)->
				passedReferedUserIds.should.deep.equal user.refered_users
				passedReferedUserCount.should.equal 3
				done()

		it 'should return an empty array if it is not set', (done)->
			user = {}
			@User.findById.callsArgWith(1, null, user)

			@handler.getReferedUsers @user_id, (err, passedReferedUserIds, passedReferedUserCount)->
				passedReferedUserIds.length.should.equal 0
				done()

		it 'should return a zero count if netither it or the array are set', (done)->
			user = {}
			@User.findById.callsArgWith(1, null, user)

			@handler.getReferedUsers @user_id, (err, passedReferedUserIds, passedReferedUserCount)->
				passedReferedUserCount.should.equal 0
				done()

		it 'should return the array length if count is not set', (done)->
			user =
				refered_users : ["1234", "312312", "3213129"]
			@User.findById.callsArgWith(1, null, user)

			@handler.getReferedUsers @user_id, (err, passedReferedUserIds, passedReferedUserCount)->
				passedReferedUserCount.should.equal 3
				done()

		it 'should return the count if it differs from the array length', (done)->
			user =
				refered_users : ["1234", "312312", "3213129"]
				refered_user_count : 5
			@User.findById.callsArgWith(1, null, user)

			@handler.getReferedUsers @user_id, (err, passedReferedUserIds, passedReferedUserCount)->
				passedReferedUserCount.should.equal 5
				done()
