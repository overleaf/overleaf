SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/LockManager'
Path = require "path"
Errors = require "../../../app/js/Errors"

describe "DockerLockManager", ->
	beforeEach ->
		@LockManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"lockfile": @Lockfile = {}
		@lockFile = "/local/compile/directory/.project-lock"

	describe "runWithLock", ->
		beforeEach ->
			@runner = sinon.stub().callsArgWith(0, null, "foo", "bar")
			@callback = sinon.stub()

		describe "normally", ->
			beforeEach ->
				@Lockfile.lock = sinon.stub().callsArgWith(2, null)
				@Lockfile.unlock = sinon.stub().callsArgWith(1, null)
				@LockManager.runWithLock @lockFile, @runner, @callback

			it "should run the compile", ->
				@runner
					.calledWith()
					.should.equal true

			it "should call the callback with the response from the compile", ->
				@callback
					.calledWithExactly(null, "foo", "bar")
					.should.equal true

		describe "when the project is locked", ->
			beforeEach ->
				@error = new Error()
				@error.code =  "EEXIST"
				@Lockfile.lock = sinon.stub().callsArgWith(2,@error)
				@Lockfile.unlock = sinon.stub().callsArgWith(1, null)
				@LockManager.runWithLock @lockFile, @runner, @callback

			it "should not run the compile", ->
				@runner
					.called
					.should.equal false

			it "should return an error", ->
				error = new Errors.AlreadyCompilingError()
				@callback
					.calledWithExactly(error)
					.should.equal true
