SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
require "coffee-script"
modulePath = require('path').join __dirname, '../../../app/coffee/DockerRunner'
Path = require "path"

describe "DockerRunner", ->
	beforeEach ->
		@container = container = {}
		@DockerRunner = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @Settings =
				clsi: docker: {}
				path: {}
			"logger-sharelatex": @logger = {
				log: sinon.stub(),
				error: sinon.stub(),
				info: sinon.stub(),
				warn: sinon.stub()
			}
			"dockerode": class Docker
				getContainer: sinon.stub().returns(container)
				createContainer: sinon.stub().yields(null, container)
				listContainers: sinon.stub()
			"fs": @fs = { stat: sinon.stub().yields(null,{isDirectory:()->true}) }
			"./Metrics":
				Timer: class Timer
					done: () ->
			"./LockManager":
				runWithLock: (key, runner, callback) -> runner(callback)
		@Docker = Docker
		@getContainer = Docker::getContainer
		@createContainer = Docker::createContainer
		@listContainers = Docker::listContainers

		@directory = "/local/compile/directory"
		@mainFile  = "main-file.tex"
		@compiler  = "pdflatex"
		@image     = "example.com/sharelatex/image:2016.2"
		@env       = {}
		@callback  = sinon.stub()
		@project_id = "project-id-123"
		@volumes =
			"/local/compile/directory": "/compile"
		@Settings.clsi.docker.image = @defaultImage = "default-image"
		@Settings.clsi.docker.env   = PATH: "mock-path"

	describe "run", ->
		beforeEach (done)->
			@DockerRunner._getContainerOptions = sinon.stub().returns(@options = {mockoptions: "foo"})
			@DockerRunner._fingerprintContainer = sinon.stub().returns(@fingerprint = "fingerprint")

			@name = "project-#{@project_id}-#{@fingerprint}"

			@command = ["mock", "command", "--outdir=$COMPILE_DIR"]
			@command_with_dir = ["mock", "command", "--outdir=/compile"]
			@timeout = 42000
			done()

		describe "successfully", ->
			beforeEach (done)->
				@DockerRunner._runAndWaitForContainer = sinon.stub().callsArgWith(3, null, @output = "mock-output")
				@DockerRunner.run @project_id, @command, @directory, @image, @timeout, @env, (err, output)=>
					@callback(err, output)
					done()

			it "should generate the options for the container", ->
				@DockerRunner._getContainerOptions
					.calledWith(@command_with_dir, @image, @volumes, @timeout)
					.should.equal true

			it "should generate the fingerprint from the returned options", ->
				@DockerRunner._fingerprintContainer
					.calledWith(@options)
					.should.equal true

			it "should do the run", ->
				@DockerRunner._runAndWaitForContainer	
					.calledWith(@options, @volumes, @timeout)		
					.should.equal true

			it "should call the callback", ->
				@callback.calledWith(null, @output).should.equal true

		describe 'when path.sandboxedCompilesHostDir is set', ->

			beforeEach ->
				@Settings.path.sandboxedCompilesHostDir = '/some/host/dir/compiles'
				@directory = '/var/lib/sharelatex/data/compiles/xyz'
				@DockerRunner._runAndWaitForContainer = sinon.stub().callsArgWith(3, null, @output = "mock-output")
				@DockerRunner.run @project_id, @command, @directory, @image, @timeout, @env, @callback

			it 'should re-write the bind directory', ->
				volumes = @DockerRunner._runAndWaitForContainer.lastCall.args[1]
				expect(volumes).to.deep.equal {
					'/some/host/dir/compiles/xyz': '/compile'
				}

			it "should call the callback", ->
				@callback.calledWith(null, @output).should.equal true

		describe "when the run throws an error", ->
			beforeEach ->
				firstTime = true
				@output = "mock-output"
				@DockerRunner._runAndWaitForContainer = (options, volumes, timeout, callback = (error, output)->) =>
					if firstTime
						firstTime = false
						callback new Error("HTTP code is 500 which indicates error: server error")
					else
						callback(null, @output)
				sinon.spy @DockerRunner, "_runAndWaitForContainer"
				@DockerRunner.destroyContainer = sinon.stub().callsArg(3)
				@DockerRunner.run @project_id, @command, @directory, @image, @timeout, @env, @callback

			it "should do the run twice", ->
				@DockerRunner._runAndWaitForContainer	
					.calledTwice.should.equal true

			it "should destroy the container in between", ->
				@DockerRunner.destroyContainer
					.calledWith(@name, null)
					.should.equal true

			it "should call the callback", ->
				@callback.calledWith(null, @output).should.equal true
		
		describe "with no image", ->
			beforeEach ->
				@DockerRunner._runAndWaitForContainer = sinon.stub().callsArgWith(3, null, @output = "mock-output")
				@DockerRunner.run @project_id, @command, @directory, null, @timeout, @env, @callback

			it "should use the default image", ->
				@DockerRunner._getContainerOptions
					.calledWith(@command_with_dir, @defaultImage, @volumes, @timeout)
					.should.equal true

	describe "_runAndWaitForContainer", ->
		beforeEach ->
			@options = {mockoptions: "foo", name: @name = "mock-name"}
			@DockerRunner.startContainer = (options, volumes, attachStreamHandler, callback) =>
				attachStreamHandler(null, @output = "mock-output")
				callback(null, @containerId = "container-id")
			sinon.spy @DockerRunner, "startContainer"
			@DockerRunner.waitForContainer = sinon.stub().callsArgWith(2, null, @exitCode = 42)
			@DockerRunner._runAndWaitForContainer @options, @volumes, @timeout, @callback

		it "should create/start the container", ->
			@DockerRunner.startContainer
				.calledWith(@options, @volumes)
				.should.equal true

		it "should wait for the container to finish", ->
			@DockerRunner.waitForContainer
				.calledWith(@name, @timeout)
				.should.equal true

		it "should call the callback with the output", ->
			@callback.calledWith(null, @output).should.equal true

	describe "startContainer", ->
		beforeEach ->
			@attachStreamHandler = sinon.stub()
			@attachStreamHandler.cock = true
			@options = {mockoptions: "foo", name: "mock-name"}
			@container.inspect = sinon.stub().callsArgWith(0)
			@DockerRunner.attachToContainer = (containerId, attachStreamHandler, cb)=> 
				attachStreamHandler()
				cb()
			sinon.spy @DockerRunner, "attachToContainer"



		describe "when the container exists", ->
			beforeEach ->
				@container.inspect = sinon.stub().callsArgWith(0)
				@container.start = sinon.stub().yields()

				@DockerRunner.startContainer @options, @volumes, @callback, ->

			it "should start the container with the given name", ->
				@getContainer
					.calledWith(@options.name)
					.should.equal true
				@container.start
					.called
					.should.equal true

			it "should not try to create the container", ->
				@createContainer.called.should.equal false
			
			it "should attach to the container", ->
				@DockerRunner.attachToContainer.called.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true
	
			it "should attach before the container starts", ->
				sinon.assert.callOrder(@DockerRunner.attachToContainer, @container.start)
						
		describe "when the container does not exist", ->
			beforeEach ()->
				exists = false
				@container.start = sinon.stub().yields()
				@container.inspect = sinon.stub().callsArgWith(0, {statusCode:404})
				@DockerRunner.startContainer @options, @volumes, @attachStreamHandler, @callback

			it "should create the container", ->
				@createContainer
					.calledWith(@options)
					.should.equal true

			it "should call the callback and stream handler", ->
				@attachStreamHandler.called.should.equal true
				@callback.called.should.equal true
			
			it "should attach to the container", ->
				@DockerRunner.attachToContainer.called.should.equal true

			it "should attach before the container starts", ->
				sinon.assert.callOrder(@DockerRunner.attachToContainer, @container.start)


		describe "when the container is already running", ->
			beforeEach ->
				error = new Error("HTTP code is 304 which indicates error: server error - start: Cannot start container #{@name}: The container MOCKID is already running.")
				error.statusCode = 304
				@container.start = sinon.stub().yields(error)
				@container.inspect = sinon.stub().callsArgWith(0)
				@DockerRunner.startContainer @options, @volumes, @attachStreamHandler, @callback

			it "should not try to create the container", ->
				@createContainer.called.should.equal false

			it "should call the callback  and stream handler without an error", ->
				@attachStreamHandler.called.should.equal true
				@callback.called.should.equal true

		describe "when a volume does not exist", ->
			beforeEach ()->
				@fs.stat = sinon.stub().yields(new Error("no such path"))
				@DockerRunner.startContainer @options, @volumes, @attachStreamHandler, @callback

			it "should not try to create the container", ->
				@createContainer.called.should.equal false

			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true

		describe "when a volume exists but is not a directory", ->
			beforeEach ->
				@fs.stat = sinon.stub().yields(null, {isDirectory: () -> return false})
				@DockerRunner.startContainer @options, @volumes, @attachStreamHandler, @callback

			it "should not try to create the container", ->
				@createContainer.called.should.equal false

			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true

		describe "when a volume does not exist, but sibling-containers are used", ->
			beforeEach ->
				@fs.stat = sinon.stub().yields(new Error("no such path"))
				@Settings.path.sandboxedCompilesHostDir = '/some/path'
				@container.start = sinon.stub().yields()
				@DockerRunner.startContainer @options, @volumes, @callback

			afterEach ->
				delete @Settings.path.sandboxedCompilesHostDir

			it "should start the container with the given name", ->
				@getContainer
					.calledWith(@options.name)
					.should.equal true
				@container.start
					.called
					.should.equal true

			it "should not try to create the container", ->
				@createContainer.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true
				@callback.calledWith(new Error()).should.equal false

		describe "when the container tries to be created, but already has been (race condition)", ->

	describe "waitForContainer", ->
		beforeEach ->
			@containerId = "container-id"
			@timeout = 5000
			@container.wait = sinon.stub().yields(null, StatusCode: @statusCode = 42)
			@container.kill = sinon.stub().yields()
			
		describe "when the container returns in time", ->
			beforeEach ->
				@DockerRunner.waitForContainer @containerId, @timeout, @callback

			it "should wait for the container", ->
				@getContainer
					.calledWith(@containerId)
					.should.equal true
				@container.wait
					.called
					.should.equal true

			it "should call the callback with the exit", ->
				@callback
					.calledWith(null, @statusCode)
					.should.equal true

		describe "when the container does not return before the timeout", ->
			beforeEach (done) ->
				@container.wait = (callback = (error, exitCode) ->) ->
					setTimeout () ->
						callback(null, StatusCode: 42)
					, 100
				@timeout = 5
				@DockerRunner.waitForContainer @containerId, @timeout, (args...) =>
					@callback(args...)
					done()

			it "should call kill on the container", ->
				@getContainer
					.calledWith(@containerId)
					.should.equal true
				@container.kill
					.called
					.should.equal true

			it "should call the callback with an error", ->
				error = new Error("container timed out")
				error.timedout = true
				@callback
					.calledWith(error)
					.should.equal true

	describe "destroyOldContainers", ->
		beforeEach (done) ->
			oneHourInSeconds = 60 * 60
			oneHourInMilliseconds = oneHourInSeconds * 1000
			nowInSeconds = Date.now()/1000
			@containers = [{
				Name: "/project-old-container-name"
				Id: "old-container-id"
				Created: nowInSeconds - oneHourInSeconds - 100
			}, {
				Name: "/project-new-container-name"
				Id: "new-container-id"
				Created: nowInSeconds - oneHourInSeconds + 100
			}, {
				Name: "/totally-not-a-project-container"
				Id: "some-random-id"
				Created: nowInSeconds - (2 * oneHourInSeconds )
			}]
			@DockerRunner.MAX_CONTAINER_AGE = oneHourInMilliseconds
			@listContainers.callsArgWith(1, null, @containers)
			@DockerRunner.destroyContainer = sinon.stub().callsArg(3)
			@DockerRunner.destroyOldContainers (error) =>
				@callback(error)
				done()

		it "should list all containers", ->
			@listContainers
				.calledWith(all: true)
				.should.equal true

		it "should destroy old containers", ->
			@DockerRunner.destroyContainer
				.callCount
				.should.equal 1
			@DockerRunner.destroyContainer
				.calledWith("/project-old-container-name", "old-container-id")
				.should.equal true

		it "should not destroy new containers", ->
			@DockerRunner.destroyContainer
				.calledWith("/project-new-container-name", "new-container-id")
				.should.equal false

		it "should not destroy non-project containers", ->
			@DockerRunner.destroyContainer
				.calledWith("/totally-not-a-project-container", "some-random-id")
				.should.equal false

		it "should callback the callback", ->
			@callback.called.should.equal true


	describe '_destroyContainer', ->
		beforeEach ->
			@containerId = 'some_id'
			@fakeContainer =
				remove: sinon.stub().callsArgWith(1, null)
			@Docker::getContainer = sinon.stub().returns(@fakeContainer)

		it 'should get the container', (done) ->
			@DockerRunner._destroyContainer @containerId, false, (err) =>
				@Docker::getContainer.callCount.should.equal 1
				@Docker::getContainer.calledWith(@containerId).should.equal true
				done()

		it 'should try to force-destroy the container when shouldForce=true', (done) ->
			@DockerRunner._destroyContainer @containerId, true, (err) =>
				@fakeContainer.remove.callCount.should.equal 1
				@fakeContainer.remove.calledWith({force: true}).should.equal true
				done()

		it 'should not try to force-destroy the container when shouldForce=false', (done) ->
			@DockerRunner._destroyContainer @containerId, false, (err) =>
				@fakeContainer.remove.callCount.should.equal 1
				@fakeContainer.remove.calledWith({force: false}).should.equal true
				done()

		it 'should not produce an error', (done) ->
			@DockerRunner._destroyContainer @containerId, false, (err) =>
				expect(err).to.equal null
				done()

		describe 'when the container is already gone', ->
			beforeEach ->
				@fakeError = new Error('woops')
				@fakeError.statusCode = 404
				@fakeContainer =
					remove: sinon.stub().callsArgWith(1, @fakeError)
				@Docker::getContainer = sinon.stub().returns(@fakeContainer)

			it 'should not produce an error', (done) ->
				@DockerRunner._destroyContainer @containerId, false, (err) =>
					expect(err).to.equal null
					done()

		describe 'when container.destroy produces an error', (done) ->
			beforeEach ->
				@fakeError = new Error('woops')
				@fakeError.statusCode = 500
				@fakeContainer =
					remove: sinon.stub().callsArgWith(1, @fakeError)
				@Docker::getContainer = sinon.stub().returns(@fakeContainer)

			it 'should produce an error', (done) ->
				@DockerRunner._destroyContainer @containerId, false, (err) =>
					expect(err).to.not.equal null
					expect(err).to.equal @fakeError
					done()


	describe 'kill', ->
		beforeEach ->
			@containerId = 'some_id'
			@fakeContainer =
				kill: sinon.stub().callsArgWith(0, null)
			@Docker::getContainer = sinon.stub().returns(@fakeContainer)

		it 'should get the container', (done) ->
			@DockerRunner.kill @containerId, (err) =>
				@Docker::getContainer.callCount.should.equal 1
				@Docker::getContainer.calledWith(@containerId).should.equal true
				done()

		it 'should try to force-destroy the container', (done) ->
			@DockerRunner.kill @containerId, (err) =>
				@fakeContainer.kill.callCount.should.equal 1
				done()

		it 'should not produce an error', (done) ->
			@DockerRunner.kill @containerId, (err) =>
				expect(err).to.equal undefined
				done()

		describe 'when the container is not actually running', ->
			beforeEach ->
				@fakeError = new Error('woops')
				@fakeError.statusCode = 500
				@fakeError.message = 'Cannot kill container <whatever> is not running'
				@fakeContainer =
					kill: sinon.stub().callsArgWith(0, @fakeError)
				@Docker::getContainer = sinon.stub().returns(@fakeContainer)

			it 'should not produce an error', (done) ->
				@DockerRunner.kill @containerId, (err) =>
					expect(err).to.equal undefined
					done()

		describe 'when container.kill produces a legitimate error', (done) ->
			beforeEach ->
				@fakeError = new Error('woops')
				@fakeError.statusCode = 500
				@fakeError.message = 'Totally legitimate reason to throw an error'
				@fakeContainer =
					kill: sinon.stub().callsArgWith(0, @fakeError)
				@Docker::getContainer = sinon.stub().returns(@fakeContainer)

			it 'should produce an error', (done) ->
				@DockerRunner.kill @containerId, (err) =>
					expect(err).to.not.equal undefined
					expect(err).to.equal @fakeError
					done()
