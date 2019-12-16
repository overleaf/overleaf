/* eslint-disable
    handle-callback-err,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const {
    assert
} = require("chai");
const sinon = require('sinon');
const chai = require('chai');
const should = chai.should();
const {
    expect
} = chai;
const modulePath = "../../../app/js/ImageOptimiser.js";
const SandboxedModule = require('sandboxed-module');

describe("ImageOptimiser", function() {

	beforeEach(function() {
		this.child_process =
			{exec : sinon.stub()};
		this.settings = 
			{enableConversions:true};
		this.optimiser = SandboxedModule.require(modulePath, { requires: {
			'child_process': this.child_process,
			"logger-sharelatex": {
				log() {},
				err() {},
				warn() {}
			},
			"settings-sharelatex": this.settings
		}
	}
		);
				

		this.sourcePath = "/this/path/here.eps";
		return this.error = "Error";
	});

	describe("compressPng", function() {
		

		it("convert the file", function(done){
			this.child_process.exec.callsArgWith(2);
			return this.optimiser.compressPng(this.sourcePath, err=> {
				const args = this.child_process.exec.args[0][0];
				args.should.equal(`optipng ${this.sourcePath}`);
				return done();
			});
		});


		return it("should return the error", function(done){
			this.child_process.exec.callsArgWith(2, this.error);
			return this.optimiser.compressPng(this.sourcePath, err=> {
				err.should.equal(this.error);
				return done();
			});
		});
	});

	describe('when enableConversions is disabled', () => it('should produce an error', function(done) {
        this.settings.enableConversions = false;
        this.child_process.exec.callsArgWith(2);
        return this.optimiser.compressPng(this.sourcePath, err=> {
            this.child_process.exec.called.should.equal(false);
            expect(err).to.exist;
            return done();
        });
    }));


	return describe('when optimiser is sigkilled', () => it('should not produce an error', function(done) {
        this.error = new Error('woops');
        this.error.signal = 'SIGKILL';
        this.child_process.exec.callsArgWith(2, this.error);
        return this.optimiser.compressPng(this.sourcePath, err=> {
            expect(err).to.equal(null);
            return done();
        });
    }));
});
