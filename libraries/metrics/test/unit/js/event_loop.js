/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const path = require('path');
const modulePath = path.join(__dirname, '../../../event_loop.js');
const SandboxedModule = require('sandboxed-module');
const sinon = require("sinon");

describe('event_loop', function() {

	before(function() {
		this.metrics = {
			timing: sinon.stub(),
			registerDestructor: sinon.stub()
		};
		this.logger = {
			warn: sinon.stub()
		};
		return this.event_loop = SandboxedModule.require(modulePath, { requires: {
			'./metrics': this.metrics
		}
	}
		);
	});

	describe('with a logger provided', function() {
		before(function() {
			return this.event_loop.monitor(this.logger);
		});

		return it('should register a destructor with metrics', function() {
			return this.metrics.registerDestructor.called.should.equal(true);
		});
	});

	return describe('without a logger provided', () => it('should throw an exception', function() {
        return expect(this.event_loop.monitor).to.throw('logger is undefined');
    }));
});

