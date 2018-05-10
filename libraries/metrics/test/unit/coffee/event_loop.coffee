require('coffee-script')
chai = require('chai')
should = chai.should()
expect = chai.expect
path = require('path')
modulePath = path.join __dirname, '../../../event_loop.coffee'
SandboxedModule = require('sandboxed-module')
sinon = require("sinon")

describe 'event_loop', ->

	before ->
		@metrics = {
			timing: sinon.stub()
			registerDestructor: sinon.stub()
		}
		@logger = {
			warn: sinon.stub()
		}
		@event_loop = SandboxedModule.require modulePath, requires:
			'./metrics': @metrics

	describe 'with a logger provided', ->
		before  ->
			@event_loop.monitor(@logger)

		it 'should register a destructor with metrics', ->
			@metrics.registerDestructor.called.should.equal true

	describe 'without a logger provided', ->
		
		it 'should throw an exception', ->
			expect(@event_loop.monitor).to.throw('logger is undefined')

