path = require("path")
sinon = require("sinon")
SandboxedModule = require('sandboxed-module')

modulePath = path.join __dirname, '../../../../app/js/Features/DocumentUpdater/DocumentUpdaterHandler'

describe "getNumberOfDocsInMemory", ->
	beforeEach ->
		@host = "doc.updater"
		@noOfDocs = 42
		@callback = sinon.stub()
		@DocumentUpdateHandler = SandboxedModule.require modulePath, requires:
			"redis" : 
				createClient: () ->
					auth:->
			"soa-req-id": null
			"logger-sharelatex": @logger =
				log: sinon.stub()
				error: sinon.stub()
			"../../infrastructure/Metrics" : @metrics
			"../../Features/Project/ProjectLocator": @ProjectLocator = {}
			"../../models/Project":Project:{}
			"request" : defaults: () => @request = {}
			"settings-sharelatex": 
				apis: documentupdater: url: @host
				redis: web:{}


		@request.get = sinon.stub().callsArgWith(1, null, {statusCode: 200}, JSON.stringify(total: @noOfDocs))
		@DocumentUpdateHandler.getNumberOfDocsInMemory @callback

	it "should call the doc updater", ->
		@request.get
			.calledWith("#{@host}/total")
			.should.equal true

	it "should return the number of docs", ->
		@callback
			.calledWith(null, @noOfDocs)
			.should.equal true

	

