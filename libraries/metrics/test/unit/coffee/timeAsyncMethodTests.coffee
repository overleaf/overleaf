require('coffee-script')
chai = require('chai')
should = chai.should()
expect = chai.expect
path = require('path')
modulePath = path.join __dirname, '../../../timeAsyncMethod.coffee'
SandboxedModule = require('sandboxed-module')
sinon = require("sinon")


describe 'timeAsyncMethod', ->

	beforeEach ->
		@Timer = {done: sinon.stub()}
		@TimerConstructor = sinon.stub().returns(@Timer)
		@metrics = {
			Timer: @TimerConstructor
			inc: sinon.stub()
		}
		@timeAsyncMethod = SandboxedModule.require modulePath, requires:
			'./metrics': @metrics

		@testObject = {
			nextNumber: (n, callback=(err, result)->) ->
				setTimeout(
					() ->
						callback(null, n+1)
					, 100
				)
		}

	it 'should have the testObject behave correctly before wrapping', (done) ->
		@testObject.nextNumber 2, (err, result) ->
			expect(err).to.not.exist
			expect(result).to.equal 3
			done()

	it 'should wrap method without error', (done) ->
		@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
		done()

	it 'should transparently wrap method invocation in timer', (done) ->
		@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
		@testObject.nextNumber 2, (err, result) =>
			expect(err).to.not.exist
			expect(result).to.equal 3
			expect(@TimerConstructor.callCount).to.equal 1
			expect(@Timer.done.callCount).to.equal 1
			done()

	it 'should increment success count', (done) ->
		@metrics.inc = sinon.stub()
		@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
		@testObject.nextNumber 2, (err, result) =>
			expect(@metrics.inc.callCount).to.equal 1
			expect(@metrics.inc.calledWith('someContext_result', 1, { method: 'TestObject_nextNumber', status: 'success'})).to.equal true
			done()

	describe 'when base method produces an error', ->
		beforeEach ->
			@metrics.inc = sinon.stub()
			@testObject.nextNumber = (n, callback=(err, result)->) ->
				setTimeout(
					() ->
						callback(new Error('woops'))
					, 100
				)

		it 'should propagate the error transparently', (done) ->
			@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
			@testObject.nextNumber 2, (err, result) =>
				expect(err).to.exist
				expect(err).to.be.instanceof Error
				expect(result).to.not.exist
				done()

		it 'should increment failure count', (done) ->
			@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
			@testObject.nextNumber 2, (err, result) =>
				expect(@metrics.inc.callCount).to.equal 1
				expect(@metrics.inc.calledWith('someContext_result', 1, { method: 'TestObject_nextNumber', status: 'failed'})).to.equal true
				done()

	describe 'when a logger is supplied', ->
		beforeEach ->
			@logger = {log: sinon.stub()}

		it 'should also call logger.log', (done) ->
			@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject', @logger
			@testObject.nextNumber 2, (err, result) =>
				expect(err).to.not.exist
				expect(result).to.equal 3
				expect(@TimerConstructor.callCount).to.equal 1
				expect(@Timer.done.callCount).to.equal 1
				expect(@logger.log.callCount).to.equal 1
				done()

	describe 'when the wrapper cannot be applied', ->
		beforeEach ->

		it 'should raise an error', ->
			badWrap = () =>
				@timeAsyncMethod @testObject, 'DEFINITELY_NOT_A_REAL_METHOD', 'someContext.TestObject'
			expect(badWrap).to.throw(
				/^.*expected object property 'DEFINITELY_NOT_A_REAL_METHOD' to be a function.*$/
			)

	describe 'when the wrapped function is not using a callback', ->
		beforeEach ->
			@realMethod =  sinon.stub().returns(42)
			@testObject.nextNumber = @realMethod

		it 'should not throw an error', ->
			@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
			badCall = () =>
				@testObject.nextNumber 2
			expect(badCall).to.not.throw(Error)

		it 'should call the underlying method', ->
			@timeAsyncMethod @testObject, 'nextNumber', 'someContext.TestObject'
			result = @testObject.nextNumber(12)
			expect(@realMethod.callCount).to.equal 1
			expect(@realMethod.calledWith(12)).to.equal true
			expect(result).to.equal 42


