assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/SafeExec.js"
SandboxedModule = require('sandboxed-module')

describe "SafeExec", ->

	beforeEach ->
		@settings = 
			enableConversions:true
		@safe_exec = SandboxedModule.require modulePath, requires:
			"logger-sharelatex":
				log:->
				err:->
			"settings-sharelatex": @settings
		@options = {timeout: 10*1000, killSignal: "SIGTERM" }

	describe "safe_exec", ->

		it "should execute a valid command", (done) ->
			@safe_exec ["/bin/echo", "hello"], @options, (err, stdout, stderr) =>
				stdout.should.equal "hello\n"
				should.not.exist(err)
				done()

		it "should error when conversions are disabled", (done) ->
			@settings.enableConversions = false
			@safe_exec ["/bin/echo", "hello"], @options, (err, stdout, stderr) =>
				expect(err).to.exist
				done()

		it "should execute a command with non-zero exit status", (done) ->
			@safe_exec ["/usr/bin/env", "false"], @options, (err, stdout, stderr) =>
				stdout.should.equal ""
				stderr.should.equal ""
				err.message.should.equal "exit status 1"
				done()

		it "should handle an invalid command", (done) ->
			@safe_exec ["/bin/foobar"], @options, (err, stdout, stderr) =>
				err.code.should.equal "ENOENT"
				done()

		it "should handle a command that runs too long", (done) ->
			@safe_exec ["/bin/sleep", "10"], {timeout: 500, killSignal: "SIGTERM"}, (err, stdout, stderr) =>
				err.should.equal "SIGTERM"
				done()
