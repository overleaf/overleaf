/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const path = require('path');
const modulePath = path.join(__dirname, '../../../timeAsyncMethod.js');
const SandboxedModule = require('sandboxed-module');
const sinon = require("sinon");


describe('timeAsyncMethod', function() {

	beforeEach(function() {
		this.Timer = {done: sinon.stub()};
		this.TimerConstructor = sinon.stub().returns(this.Timer);
		this.metrics = {
			Timer: this.TimerConstructor,
			inc: sinon.stub()
		};
		this.timeAsyncMethod = SandboxedModule.require(modulePath, { requires: {
			'./metrics': this.metrics
		}
	}
		);

		return this.testObject = {
			nextNumber(n, callback) {
				if (callback == null) { callback = function(err, result){}; }
				return setTimeout(
					() => callback(null, n+1)
					, 100
				);
			}
		};});

	it('should have the testObject behave correctly before wrapping', function(done) {
		return this.testObject.nextNumber(2, function(err, result) {
			expect(err).to.not.exist;
			expect(result).to.equal(3);
			return done();
		});
	});

	it('should wrap method without error', function(done) {
		this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
		return done();
	});

	it('should transparently wrap method invocation in timer', function(done) {
		this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
		return this.testObject.nextNumber(2, (err, result) => {
			expect(err).to.not.exist;
			expect(result).to.equal(3);
			expect(this.TimerConstructor.callCount).to.equal(1);
			expect(this.Timer.done.callCount).to.equal(1);
			return done();
		});
	});

	it('should increment success count', function(done) {
		this.metrics.inc = sinon.stub();
		this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
		return this.testObject.nextNumber(2, (err, result) => {
			expect(this.metrics.inc.callCount).to.equal(1);
			expect(this.metrics.inc.calledWith('someContext_result', 1, { method: 'TestObject_nextNumber', status: 'success'})).to.equal(true);
			return done();
		});
	});

	describe('when base method produces an error', function() {
		beforeEach(function() {
			this.metrics.inc = sinon.stub();
			return this.testObject.nextNumber = function(n, callback) {
				if (callback == null) { callback = function(err, result){}; }
				return setTimeout(
					() => callback(new Error('woops'))
					, 100
				);
			};
		});

		it('should propagate the error transparently', function(done) {
			this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
			return this.testObject.nextNumber(2, (err, result) => {
				expect(err).to.exist;
				expect(err).to.be.instanceof(Error);
				expect(result).to.not.exist;
				return done();
			});
		});

		return it('should increment failure count', function(done) {
			this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
			return this.testObject.nextNumber(2, (err, result) => {
				expect(this.metrics.inc.callCount).to.equal(1);
				expect(this.metrics.inc.calledWith('someContext_result', 1, { method: 'TestObject_nextNumber', status: 'failed'})).to.equal(true);
				return done();
			});
		});
	});

	describe('when a logger is supplied', function() {
		beforeEach(function() {
			return this.logger = {log: sinon.stub()};});

		return it('should also call logger.log', function(done) {
			this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject', this.logger);
			return this.testObject.nextNumber(2, (err, result) => {
				expect(err).to.not.exist;
				expect(result).to.equal(3);
				expect(this.TimerConstructor.callCount).to.equal(1);
				expect(this.Timer.done.callCount).to.equal(1);
				expect(this.logger.log.callCount).to.equal(1);
				return done();
			});
		});
	});

	describe('when the wrapper cannot be applied', function() {
		beforeEach(function() {});

		return it('should raise an error', function() {
			const badWrap = () => {
				return this.timeAsyncMethod(this.testObject, 'DEFINITELY_NOT_A_REAL_METHOD', 'someContext.TestObject');
			};
			return expect(badWrap).to.throw(
				/^.*expected object property 'DEFINITELY_NOT_A_REAL_METHOD' to be a function.*$/
			);
		});
	});

	return describe('when the wrapped function is not using a callback', function() {
		beforeEach(function() {
			this.realMethod =  sinon.stub().returns(42);
			return this.testObject.nextNumber = this.realMethod;
		});

		it('should not throw an error', function() {
			this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
			const badCall = () => {
				return this.testObject.nextNumber(2);
			};
			return expect(badCall).to.not.throw(Error);
		});

		return it('should call the underlying method', function() {
			this.timeAsyncMethod(this.testObject, 'nextNumber', 'someContext.TestObject');
			const result = this.testObject.nextNumber(12);
			expect(this.realMethod.callCount).to.equal(1);
			expect(this.realMethod.calledWith(12)).to.equal(true);
			return expect(result).to.equal(42);
		});
	});
});


