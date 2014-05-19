sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/CompileManager.js"
assert = require("chai").assert
SandboxedModule = require('sandboxed-module')

describe "CompileManager", ->
	beforeEach ->
		@rateLimitGetStub = sinon.stub()
		rateLimitGetStub = @rateLimitGetStub
		@ratelimiter = 
			addCount: sinon.stub()
		@CompileManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings =
				redis: web: {host: "localhost", port: 42}
			"redis":
				createClient: () => @rclient = { auth: () -> }
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler = {}
			"../Project/ProjectRootDocManager": @ProjectRootDocManager = {}
			"../../models/Project": Project: @Project = {}
			"./ClsiManager": @ClsiManager = {}
			"../../infrastructure/RateLimiter": @ratelimiter
			"../../infrastructure/Metrics": @Metrics =
				Timer: class Timer
					done: sinon.stub()
				inc: sinon.stub()
			"logger-sharelatex": @logger = { log: sinon.stub() }
		@project_id = "mock-project-id-123"
		@user_id = "mock-user-id-123"
		@callback = sinon.stub()

	describe "compile", ->
		beforeEach ->
			@CompileManager._checkIfRecentlyCompiled = sinon.stub().callsArgWith(2, null, false)
			@CompileManager._ensureRootDocumentIsSet = sinon.stub().callsArgWith(1, null)
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArgWith(1, null)
			@ClsiManager.sendRequest = sinon.stub().callsArgWith(1, null, @status = "mock-status")

		describe "succesfully", ->
			beforeEach ->
				@CompileManager._checkIfAutoCompileLimitHasBeenHit = (_, cb)-> cb(null, true)
				@CompileManager.compile @project_id, @user_id, {}, @callback

			it "should check the project has not been recently compiled", ->
				@CompileManager._checkIfRecentlyCompiled
					.calledWith(@project_id, @user_id)
					.should.equal true

			it "should flush the project to the database", ->
				@DocumentUpdaterHandler.flushProjectToMongo
					.calledWith(@project_id)
					.should.equal true

			it "should ensure that the root document is set", ->
				@CompileManager._ensureRootDocumentIsSet
					.calledWith(@project_id)
					.should.equal true

			it "should run the compile with the new compiler API", ->
				@ClsiManager.sendRequest
					.calledWith(@project_id)
					.should.equal true

			it "should call the callback", ->
				@callback
					.calledWith(null, @status)
					.should.equal true

			it "should time the compile", ->
				@Metrics.Timer::done.called.should.equal true

			it "should log out the compile", ->
				@logger.log
					.calledWith(project_id: @project_id, user_id: @user_id, "compiling project")
					.should.equal true

		describe "when the compile fails", ->
			beforeEach ->
				@CompileManager._checkIfAutoCompileLimitHasBeenHit = (_, cb)-> cb(null, true)
				@ClsiManager.deleteAuxFiles = sinon.stub()
				@ClsiManager.sendRequest = sinon.stub().callsArgWith(1, null, @status = "failure")
				@CompileManager.compile @project_id, @user_id, {}, @callback

			it "should call the callback", ->
				@callback
					.calledWith(null, @status)
					.should.equal true

			it "should clear the CLSI cache", ->
				@ClsiManager.deleteAuxFiles
					.calledWith(@project_id)
					.should.equal true
				
		describe "when the project has been recently compiled", ->
			beforeEach ->
				@CompileManager._checkIfAutoCompileLimitHasBeenHit = (_, cb)-> cb(null, true)
				@CompileManager._checkIfRecentlyCompiled = sinon.stub().callsArgWith(2, null, true)
				@CompileManager.compile @project_id, @user_id, {}, @callback

			it "should return the callback with an error", ->
				@callback
					.calledWith(new Error("project was recently compiled so not continuing"))
					.should.equal true

		describe "should check the rate limit", ->
			it "should return", (done)->
				@CompileManager._checkIfAutoCompileLimitHasBeenHit = sinon.stub().callsArgWith(1, null, false)
				@CompileManager.compile @project_id, @user_id, {}, (err, status)->
					status.should.equal "autocompile-backoff"
					done()

	describe "getLogLines", ->
		beforeEach ->
			@ClsiManager.getLogLines = sinon.stub().callsArgWith(1, null, @lines = ["log", "lines"])
			@CompileManager.getLogLines @project_id, @callback

		it "should call the new api", ->
			@ClsiManager.getLogLines
				.calledWith(@project_id)
				.should.equal true

		it "should call the callback with the lines", ->
			@callback
				.calledWith(null, @lines)
				.should.equal true

		it "should increase the log count metric", ->
			@Metrics.inc
				.calledWith("editor.raw-logs")
				.should.equal true

	describe "_checkIfRecentlyCompiled", ->
		describe "when the key exists in redis", ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(5, null, null)
				@CompileManager._checkIfRecentlyCompiled(@project_id, @user_id, @callback)

			it "should try to set the key", ->
				@rclient.set
					.calledWith("compile:#{@project_id}:#{@user_id}", true, "EX", @CompileManager.COMPILE_DELAY, "NX")
					.should.equal true

			it "should call the callback with true", ->
				@callback.calledWith(null, true).should.equal true

		describe "when the key does not exist in redis", ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(5, null, "OK")
				@CompileManager._checkIfRecentlyCompiled(@project_id, @user_id, @callback)

			it "should try to set the key", ->
				@rclient.set
					.calledWith("compile:#{@project_id}:#{@user_id}", true, "EX", @CompileManager.COMPILE_DELAY, "NX")
					.should.equal true

			it "should call the callback with false", ->
				@callback.calledWith(null, false).should.equal true
				
	describe "_ensureRootDocumentIsSet", ->
		beforeEach ->
			@project = {}
			@Project.findById = sinon.stub().callsArgWith(2, null, @project)
			@ProjectRootDocManager.setRootDocAutomatically = sinon.stub().callsArgWith(1, null)
			
		describe "when the root doc is set", ->
			beforeEach ->
				@project.rootDoc_id = "root-doc-id"
				@CompileManager._ensureRootDocumentIsSet(@project_id, @callback)

			it "should find the project with only the rootDoc_id fiel", ->
				@Project.findById
					.calledWith(@project_id, "rootDoc_id")
					.should.equal true

			it "should not try to update the project rootDoc_id", ->
				@ProjectRootDocManager.setRootDocAutomatically
					.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the root doc is not set", ->
			beforeEach ->
				@CompileManager._ensureRootDocumentIsSet(@project_id, @callback)

			it "should find the project with only the rootDoc_id fiel", ->
				@Project.findById
					.calledWith(@project_id, "rootDoc_id")
					.should.equal true

			it "should update the project rootDoc_id", ->
				@ProjectRootDocManager.setRootDocAutomatically
					.calledWith(@project_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true
		
		describe "when the project does not exist", ->
			beforeEach ->
				@Project.findById = sinon.stub().callsArgWith(2, null, null)
				@CompileManager._ensureRootDocumentIsSet(@project_id, @callback)

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("project not found")).should.equal true
			
	describe "_checkIfAutoCompileLimitHasBeenHit", ->

		it "should be able to compile if it is not an autocompile", (done)->
			@ratelimiter.addCount.callsArgWith(1, null, true)
			@CompileManager._checkIfAutoCompileLimitHasBeenHit false, (err, canCompile)=>
				canCompile.should.equal true
				done()

		it "should be able to compile if rate limit has remianing", (done)->
			@ratelimiter.addCount.callsArgWith(1, null, true)
			@CompileManager._checkIfAutoCompileLimitHasBeenHit true, (err, canCompile)=>
				args = @ratelimiter.addCount.args[0][0]
				args.throttle.should.equal 10
				args.subjectName.should.equal "everyone"
				args.timeInterval.should.equal 15
				args.endpointName.should.equal "auto_compile"
				canCompile.should.equal true
				done()

		it "should be not able to compile if rate limit has no remianing", (done)->
			@ratelimiter.addCount.callsArgWith(1, null, false)
			@CompileManager._checkIfAutoCompileLimitHasBeenHit true, (err, canCompile)=>
				canCompile.should.equal false
				done()

		it "should return false if there is an error in the rate limit", (done)->
			@ratelimiter.addCount.callsArgWith(1, "error")
			@CompileManager._checkIfAutoCompileLimitHasBeenHit true, (err, canCompile)=>
				canCompile.should.equal false
				done()
