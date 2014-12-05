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
			"redis-sharelatex":
				createClient: () => @rclient = { auth: () -> }
			"../DocumentUpdater/DocumentUpdaterHandler": @DocumentUpdaterHandler = {}
			"../Project/ProjectRootDocManager": @ProjectRootDocManager = {}
			"../../models/Project": Project: @Project = {}
			"../User/UserGetter": @UserGetter = {}
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
		@limits = {
			timeout: 42
		}

	
	describe "compile", ->
		beforeEach ->
			@CompileManager._checkIfRecentlyCompiled = sinon.stub().callsArgWith(2, null, false)
			@CompileManager._ensureRootDocumentIsSet = sinon.stub().callsArgWith(1, null)
			@DocumentUpdaterHandler.flushProjectToMongo = sinon.stub().callsArgWith(1, null)
			@CompileManager.getProjectCompileLimits = sinon.stub().callsArgWith(1, null, @limits)
			@ClsiManager.sendRequest = sinon.stub().callsArgWith(2, null, @status = "mock-status", @outputFiles = "mock output files", @output = "mock output")

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

			it "should get the project compile limits", ->
				@CompileManager.getProjectCompileLimits
					.calledWith(@project_id)
					.should.equal true

			it "should run the compile with the compile limits", ->
				@ClsiManager.sendRequest
					.calledWith(@project_id, {
						timeout: @limits.timeout
					})
					.should.equal true

			it "should call the callback with the output", ->
				@callback
					.calledWith(null, @status, @outputFiles, @output)
					.should.equal true

			it "should time the compile", ->
				@Metrics.Timer::done.called.should.equal true

			it "should log out the compile", ->
				@logger.log
					.calledWith(project_id: @project_id, user_id: @user_id, "compiling project")
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
					
	describe "getProjectCompileLimits", ->
		beforeEach ->
			@features = {
				compileTimeout:   @timeout = 42
				compileGroup:     @group = "priority"
			}
			@Project.findById = sinon.stub().callsArgWith(2, null, @project = { owner_ref: @owner_id = "owner-id-123" })
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @user = { features: @features })
			@CompileManager.getProjectCompileLimits @project_id, @callback
			
		it "should look up the owner of the project", ->
			@Project.findById
				.calledWith(@project_id, { owner_ref: 1 })
				.should.equal true
				
		it "should look up the owner's features", ->
			@UserGetter.getUser
				.calledWith(@project.owner_ref, { features: 1 })
				.should.equal true
				
		it "should return the limits", ->
			@callback
				.calledWith(null, {
					timeout:      @timeout
					compileGroup: @group
				})
				.should.equal true
				
	describe "deleteAuxFiles", ->
		beforeEach ->
			@CompileManager.getProjectCompileLimits = sinon.stub().callsArgWith 1, null, @limits = { compileGroup: "mock-compile-group" }
			@ClsiManager.deleteAuxFiles = sinon.stub().callsArg(2)
			@CompileManager.deleteAuxFiles @project_id, @callback
			
		it "should look up the compile group to use", ->
			@CompileManager.getProjectCompileLimits
				.calledWith(@project_id)
				.should.equal true
				
		it "should delete the aux files", ->
			@ClsiManager.deleteAuxFiles
				.calledWith(@project_id, @limits)
				.should.equal true
				
		it "should call the callback", ->
			@callback.called.should.equal true

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
				args.throttle.should.equal 15
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
