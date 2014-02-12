spies = require('chai-spies')
chai = require('chai').use(spies)
sinon = require('sinon')
should = chai.should()
modulePath = "../../../../app/js/Features/Versioning/VersioningApiController"
SandboxedModule = require('sandboxed-module')
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "VersioningApiController", ->
	beforeEach ->
		@handler = {}
		@controller = SandboxedModule.require modulePath, requires:
			'./VersioningApiHandler':@handler
		@req = new MockRequest()
		@res = new MockResponse()
	
	describe "takeSnapshot", ->
		beforeEach ->
			@error = null
			@handler.takeSnapshot = (project_id, message, callback) =>
				callback(@error)
			sinon.spy @handler, "takeSnapshot"
			@req.params = Project_id: "project_id"
		
		describe "successfully", ->
			beforeEach ->
				@error = null
				@req.body = message: "hello world"
				@controller.takeSnapshot(@req, @res)

			it "should call VersioningApiHandler.takeSnapshot", ->
				@handler.takeSnapshot.calledWith(
					"project_id", @req.body.message
				).should.equal true

			it "should return a successful response", ->
				@res.returned.should.equal true
				@res.success.should.equal true
				@res.body.should.equal "{}"

		describe "without message", ->
			beforeEach ->
				@error = null
				@controller.takeSnapshot(@req, @res)

			it "should use a default message", ->
				@handler.takeSnapshot.calledWith(
					"project_id", "Manual snapshot"
				).should.equal true

		describe "with errors", ->
			beforeEach ->
				@error = new Error("Oops")
				@next = sinon.stub()
				@controller.takeSnapshot(@req, @res, @next)

			it "should call next() with the error", ->
				@res.returned.should.equal false
				@next.called.should.equal true

	it 'enable versioning in the handler', (done)->
		project_id = "1234"
		
		@handler.enableVersioning = (sentProjectId, callback)->
			sentProjectId.should.equal project_id
			callback null

		@controller.enableVersioning project_id, ->
			done()

	it 'proxys list versions', (done)->
		shouldProxy @controller.listVersions, @handler, done

	it 'proxys get version', (done)->
		shouldProxy @controller.getVersion, @handler, done

	it 'proxys get verion file', (done)->
		shouldProxy @controller.getVersionFile, @handler, done

shouldProxy = (fun, handler, callback)->
		req = {"stuf":"here"}
		res = {"other":"stuff"}

		handler.proxyToVersioningApi = (proxyReq, proxyRes)->
			proxyReq.should.deep.equal req
			proxyRes.should.deep.equal res
			callback()
		fun req, res
