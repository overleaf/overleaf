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
const modulePath = "../../../app/js/SafeExec.js";
const SandboxedModule = require('sandboxed-module');

describe("SafeExec", function() {

	beforeEach(function() {
		this.settings = 
			{enableConversions:true};
		this.safe_exec = SandboxedModule.require(modulePath, { requires: {
			"logger-sharelatex": {
				log() {},
				err() {}
			},
			"settings-sharelatex": this.settings
		}
	}
		);
		return this.options = {timeout: 10*1000, killSignal: "SIGTERM" };});

	return describe("safe_exec", function() {

		it("should execute a valid command", function(done) {
			return this.safe_exec(["/bin/echo", "hello"], this.options, (err, stdout, stderr) => {
				stdout.should.equal("hello\n");
				should.not.exist(err);
				return done();
			});
		});

		it("should error when conversions are disabled", function(done) {
			this.settings.enableConversions = false;
			return this.safe_exec(["/bin/echo", "hello"], this.options, (err, stdout, stderr) => {
				expect(err).to.exist;
				return done();
			});
		});

		it("should execute a command with non-zero exit status", function(done) {
			return this.safe_exec(["/usr/bin/env", "false"], this.options, (err, stdout, stderr) => {
				stdout.should.equal("");
				stderr.should.equal("");
				err.message.should.equal("exit status 1");
				return done();
			});
		});

		it("should handle an invalid command", function(done) {
			return this.safe_exec(["/bin/foobar"], this.options, (err, stdout, stderr) => {
				err.code.should.equal("ENOENT");
				return done();
			});
		});

		return it("should handle a command that runs too long", function(done) {
			return this.safe_exec(["/bin/sleep", "10"], {timeout: 500, killSignal: "SIGTERM"}, (err, stdout, stderr) => {
				err.should.equal("SIGTERM");
				return done();
			});
		});
	});
});
