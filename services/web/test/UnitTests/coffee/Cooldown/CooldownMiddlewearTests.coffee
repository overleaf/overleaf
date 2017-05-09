SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
modulePath = require('path').join __dirname, '../../../../app/js/Features/Cooldown/CooldownMiddlewear'


describe "CooldownMiddlewear", ->

	beforeEach ->
		@CooldownManager =
			isProjectOnCooldown: sinon.stub()
		@CooldownMiddlewear = SandboxedModule.require modulePath, requires:
			'./CooldownManager': @CooldownManager
			'logger-sharelatex': {log: sinon.stub()}

	describe 'freezeProject', ->

		describe 'when project is on cooldown', ->
			beforeEach ->
				@CooldownManager.isProjectOnCooldown = sinon.stub().callsArgWith(1, null, true)
				@req = {params: {Project_id: 'abc'}}
				@res = {sendStatus: sinon.stub()}
				@next = sinon.stub()

			it 'should call CooldownManager.isProjectOnCooldown', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@CooldownManager.isProjectOnCooldown.callCount.should.equal 1
				@CooldownManager.isProjectOnCooldown.calledWith('abc').should.equal true

			it 'should not produce an error', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@next.callCount.should.equal 0

			it 'should send a 429 status', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@res.sendStatus.callCount.should.equal 1
				@res.sendStatus.calledWith(429).should.equal true

		describe 'when project is not on cooldown', ->
			beforeEach ->
				@CooldownManager.isProjectOnCooldown = sinon.stub().callsArgWith(1, null, false)
				@req = {params: {Project_id: 'abc'}}
				@res = {sendStatus: sinon.stub()}
				@next = sinon.stub()

			it 'should call CooldownManager.isProjectOnCooldown', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@CooldownManager.isProjectOnCooldown.callCount.should.equal 1
				@CooldownManager.isProjectOnCooldown.calledWith('abc').should.equal true

			it 'call next with no arguments', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@next.callCount.should.equal 1
				expect(@next.lastCall.args.length).to.equal 0

		describe 'when isProjectOnCooldown produces an error', ->
			beforeEach ->
				@CooldownManager.isProjectOnCooldown = sinon.stub().callsArgWith(1, new Error('woops'))
				@req = {params: {Project_id: 'abc'}}
				@res = {sendStatus: sinon.stub()}
				@next = sinon.stub()

			it 'should call CooldownManager.isProjectOnCooldown', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@CooldownManager.isProjectOnCooldown.callCount.should.equal 1
				@CooldownManager.isProjectOnCooldown.calledWith('abc').should.equal true

			it 'call next with an error', ->
				@CooldownMiddlewear.freezeProject @req, @res, @next
				@next.callCount.should.equal 1
				expect(@next.lastCall.args[0]).to.be.instanceof Error
