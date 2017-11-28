SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
modulePath = require('path').join __dirname, '../../../../app/js/Features/Cooldown/CooldownManager'


describe "CooldownManager", ->

	beforeEach ->
		@projectId = 'abcdefg'
		@rclient = {set: sinon.stub(), get: sinon.stub()}
		@RedisWrapper =
			client: () => @rclient
		@CooldownManager = SandboxedModule.require modulePath, requires:
			'../../infrastructure/RedisWrapper': @RedisWrapper
			'logger-sharelatex': {log: sinon.stub()}

	describe '_buildKey', ->

		it 'should build a properly formatted redis key', ->
			expect(@CooldownManager._buildKey('ABC')).to.equal 'Cooldown:{ABC}'

	describe 'isProjectOnCooldown', ->
		beforeEach ->
			@call = (cb) =>
				@CooldownManager.isProjectOnCooldown @projectId, cb

		describe 'when project is on cooldown', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, null, '1')

			it 'should fetch key from redis', (done) ->
				@call (err, result) =>
					@rclient.get.callCount.should.equal 1
					@rclient.get.calledWith('Cooldown:{abcdefg}').should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call (err, result) =>
					expect(err).to.equal null
					done()

			it 'should produce a true result', (done) ->
				@call (err, result) =>
					expect(result).to.equal true
					done()

		describe 'when project is not on cooldown', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, null, null)

			it 'should fetch key from redis', (done) ->
				@call (err, result) =>
					@rclient.get.callCount.should.equal 1
					@rclient.get.calledWith('Cooldown:{abcdefg}').should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call (err, result) =>
					expect(err).to.equal null
					done()

			it 'should produce a false result', (done) ->
				@call (err, result) =>
					expect(result).to.equal false
					done()

		describe 'when rclient.get produces an error', ->
			beforeEach ->
				@rclient.get = sinon.stub().callsArgWith(1, new Error('woops'))

			it 'should fetch key from redis', (done) ->
				@call (err, result) =>
					@rclient.get.callCount.should.equal 1
					@rclient.get.calledWith('Cooldown:{abcdefg}').should.equal true
					done()

			it 'should produce an error', (done) ->
				@call (err, result) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()

	describe 'putProjectOnCooldown', ->

		beforeEach ->
			@call = (cb) =>
				@CooldownManager.putProjectOnCooldown @projectId, cb

		describe 'when rclient.set does not produce an error', ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(4, null)

			it 'should set a key in redis', (done) ->
				@call (err) =>
					@rclient.set.callCount.should.equal 1
					@rclient.set.calledWith('Cooldown:{abcdefg}').should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.equal null
					done()

		describe 'when rclient.set produces an error', ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(4, new Error('woops'))

			it 'should set a key in redis', (done) ->
				@call (err) =>
					@rclient.set.callCount.should.equal 1
					@rclient.set.calledWith('Cooldown:{abcdefg}').should.equal true
					done()

			it 'produce an error', (done) ->
				@call (err) =>
					expect(err).to.not.equal null
					expect(err).to.be.instanceof Error
					done()
