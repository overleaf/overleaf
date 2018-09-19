SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require('chai').expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/SudoMode/SudoModeHandler'


describe 'SudoModeHandler', ->
	beforeEach ->
		@userId = 'some_user_id'
		@email = 'someuser@example.com'
		@user =
			_id: @userId
			email: @email
		@rclient = {get: sinon.stub(), set: sinon.stub(), del: sinon.stub()}
		@RedisWrapper =
			client: () => @rclient
		@SudoModeHandler = SandboxedModule.require modulePath, requires:
			'../../infrastructure/RedisWrapper': @RedisWrapper
			'logger-sharelatex': @logger = {log: sinon.stub(), err: sinon.stub()}
			'../Authentication/AuthenticationManager': @AuthenticationManager = {}

	describe '_buildKey', ->

		it 'should build a properly formed key', ->
			expect(@SudoModeHandler._buildKey('123')).to.equal 'SudoMode:{123}'

	describe 'activateSudoMode', ->
		beforeEach ->
			@call = (cb) =>
				@SudoModeHandler.activateSudoMode @userId, cb

		describe 'when all goes well', ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(4, null)


			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.equal null
					done()

			it 'should set a value in redis', (done) ->
				@call (err) =>
					expect(@rclient.set.callCount).to.equal 1
					expect(@rclient.set.calledWith(
						'SudoMode:{some_user_id}', '1', 'EX', 60*60
					)).to.equal true
					done()

		describe 'when user id is not supplied', ->
			beforeEach ->
				@call = (cb) =>
					@SudoModeHandler.activateSudoMode null, cb

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

			it 'should not set value in redis', (done) ->
				@call (err) =>
					expect(@rclient.set.callCount).to.equal 0
					done()

		describe 'when rclient.set produces an error', ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(4, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

	describe 'clearSudoMode', ->
		beforeEach ->
			@rclient.del = sinon.stub().callsArgWith(1, null)
			@call = (cb) =>
				@SudoModeHandler.clearSudoMode @userId, cb

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.equal null
				done()

		it 'should delete key from redis', (done) ->
			@call (err) =>
				expect(@rclient.del.callCount).to.equal 1
				expect(@rclient.del.calledWith(
					'SudoMode:{some_user_id}'
				)).to.equal true
				done()

		describe 'when rclient.del produces an error', ->
			beforeEach ->
				@rclient.del = sinon.stub().callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

		describe 'when user id is not supplied', ->
			beforeEach ->
				@call = (cb) =>
					@SudoModeHandler.clearSudoMode null, cb

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

			it 'should not delete value in redis', (done) ->
				@call (err) =>
					expect(@rclient.del.callCount).to.equal 0
					done()

	describe 'authenticate', ->
		beforeEach ->
			@AuthenticationManager.authenticate = sinon.stub().callsArgWith(2, null, @user)

		it 'should call AuthenticationManager.authenticate', (done) ->
			@SudoModeHandler.authenticate @email, 'password', (err, user) =>
				expect(err).to.not.exist
				expect(user).to.exist
				expect(user).to.deep.equal @user
				expect(@AuthenticationManager.authenticate.callCount).to.equal 1
				done()

	describe 'isSudoModeActive', ->
		beforeEach ->
			@call = (cb) =>
				@SudoModeHandler.isSudoModeActive @userId, cb

		describe 'when sudo-mode is active for that user', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, null, '1')

			it 'should not produce an error', (done) ->
				@call (err, isActive) =>
					expect(err).to.equal null
					done()

			it 'should get the value from redis', (done) ->
				@call (err, isActive) =>
					expect(@rclient.get.callCount).to.equal 1
					expect(@rclient.get.calledWith('SudoMode:{some_user_id}')).to.equal true
					done()

			it 'should produce a true result', (done) ->
				@call (err, isActive) =>
					expect(isActive).to.equal true
					done()

		describe 'when sudo-mode is not active for that user', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, null, null)

			it 'should not produce an error', (done) ->
				@call (err, isActive) =>
					expect(err).to.equal null
					done()

			it 'should get the value from redis', (done) ->
				@call (err, isActive) =>
					expect(@rclient.get.callCount).to.equal 1
					expect(@rclient.get.calledWith('SudoMode:{some_user_id}')).to.equal true
					done()

			it 'should produce a false result', (done) ->
				@call (err, isActive) =>
					expect(isActive).to.equal false
					done()

		describe 'when rclient.get produces an error', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err, isActive) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					expect(isActive).to.be.oneOf [null, undefined]
					done()

		describe 'when user id is not supplied', ->
			beforeEach ->
				@call = (cb) =>
					@SudoModeHandler.isSudoModeActive null, cb

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

			it 'should not get value in redis', (done) ->
				@call (err) =>
					expect(@rclient.get.callCount).to.equal 0
					done()
