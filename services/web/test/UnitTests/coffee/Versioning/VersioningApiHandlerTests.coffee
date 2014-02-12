assert = require('chai').assert
chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Versioning/VersioningApiHandler"
SandboxedModule = require('sandboxed-module')
tk = require 'timekeeper'

describe "VersioningApiHandler", ->

	beforeEach ->
		tk.freeze(Date.now())
		@fakeHttp ={}
		@requestQueuer = {}
		@thirdParyDataStoreManager = {}
		@documentUpdaterHandler =
			flushProjectToMongo : (project_id, sl_req_id, callback) -> callback()
		@projectEntityHandler = {}
		@ProjectModel =
			getProject : (project_id, fields, callback)=>
				callback(null, @project)
		@rclient =
			auth:->
			srem: sinon.stub().callsArg(2)
			set: sinon.stub().callsArg(2)
		@settings = 
			apis:
				versioning:
					snapshotwaitInMs:100
					url: "http://localhost:4000"
					username:"username"
					password:"password"
			redis:
				web: {}
				fairy: {}
		@versioningApi = SandboxedModule.require modulePath,
			requires:
				'../../models/Project':{Project:@ProjectModel}
				'../../Features/DocumentUpdater/DocumentUpdaterHandler' : @documentUpdaterHandler
				'../../Features/Project/ProjectEntityHandler' : @projectEntityHandler
				'fairy':{connect:=>{queue:=>@requestQueuer}}
				'request': @fakeHttp
				'settings-sharelatex' : @settings
				'logger-sharelatex': 
					log:->
					err:->
				'redis' : createClient: () => @rclient
			globals:
				Date: Date

		@project =  _id:"123456", existsInVersioningApi : false
		@callback = sinon.stub()
	
	afterEach -> tk.reset()
	
	it 'should create project in versioning api using request queuer', (done)->
		@requestQueuer.enqueue = (project_id, method, options, callback)=>
			project_id.should.equal @project._id
			method.should.equal "standardHttpRequest"
			options.method.should.equal "post"
			options.url.should.equal("#{@settings.apis.versioning.url}/project/#{@project._id}")
			done()	
		@versioningApi.createProject(@project._id)

	describe "takeSnapshot", ->
		beforeEach ->
			@message = "finished chapter"
			@requestQueuer.enqueue = (project_id, method, options, callback) -> callback()
			sinon.spy @requestQueuer, "enqueue"
			sinon.spy @documentUpdaterHandler, "flushProjectToMongo"
			@versioningApi.takeSnapshot(@project._id, @message)

		afterEach ->
			@documentUpdaterHandler.flushProjectToMongo.restore()

		it 'should flush the document to the third party datastore', ->
			@documentUpdaterHandler.flushProjectToMongo.calledWith(@project._id).should.equal true
			@documentUpdaterHandler.flushProjectToMongo.calledBefore(@requestQueuer.enqueue)
			
		it 'should queue a request for the versioning api', ->
			@requestQueuer.enqueue.calledWith(@project._id, "standardHttpRequest").should.equal true
			options = @requestQueuer.enqueue.args[0][2]
			options.method.should.equal "post"
			options.url.should.equal("#{@settings.apis.versioning.url}/project/#{@project._id}/version")
			assert.deepEqual options.json, {version: {message: @message}}

		it "should remove the project from the set needing snapshotting", ->
			@rclient.srem.calledWith("projects_to_snapshot", @project._id).should.equal true

		it "should set the project's last snapshot date", ->
			@rclient.set.calledWith("project_last_snapshot:#{@project._id}", Date.now()).should.equal true

	it 'proxyToVersioningApi pipes to url passed', (done)->
		res = {some:"stuff"}
		req = url : "/somewhere"

		@fakeHttp.get = (options)=>
			options.url.should.equal("#{@settings.apis.versioning.url}#{req.url}")
			return {
				pipe:(pipedResponse)->
					pipedResponse.should.deep.equal res
					done()
				on: () ->
			}

		@versioningApi.proxyToVersioningApi req, res

	describe "enableVersioning", ->
		beforeEach ->
			@projectEntityHandler.flushProjectToThirdPartyDataStore = sinon.stub().callsArg(1)
			@versioningApi.createProject = sinon.stub().callsArg(1)
			@ProjectModel.update = sinon.stub().callsArg(3)
			
		describe "successfully", ->
			beforeEach ->
				@versioningApi.enableVersioning @project._id, ->

			it "should flush the project to the TPDS", ->
				@projectEntityHandler.flushProjectToThirdPartyDataStore.calledWith(@project._id)
					.should.equal true

			it "should create the project in the versioning api", ->
				@versioningApi.createProject.calledWith(@project._id)
					.should.equal true

			it "should set the existsInVersioningApi flag to true", ->
				@ProjectModel.update.calledWith({_id: @project._id}, {existsInVersioningApi: true})
					.should.equal true

		describe "with a non existant project id", ->
			beforeEach ->
				@ProjectModel.getProject = (project_id, fields, callback)->
					callback null, null
				@versioningApi.enableVersioning @project._id, @callback

			it "should return an error", ->
				should.exist @callback.args[0][0]

			it "should not try to enable versioning", ->
				@projectEntityHandler.flushProjectToThirdPartyDataStore.called.should.equal false
				@versioningApi.createProject.called.should.equal false
				@ProjectModel.update.called.should.equal false

		describe "when versioning API request fails", ->
			beforeEach ->
				@versioningApi.createProject = sinon.stub().callsArgWith(1, new Error("something went wrong"))
				@versioningApi.enableVersioning @project._id, @callback

			it "should return an error", ->
				should.exist @callback.args[0][0]

			it "should not try to flush the project or save the change", ->
				@projectEntityHandler.flushProjectToThirdPartyDataStore.called.should.equal false
				@ProjectModel.update.called.should.equal false

		describe "when the project already has versioning enabled", ->
			beforeEach ->
				@project.existsInVersioningApi = true
				@versioningApi.enableVersioning @project._id, @callback
		
			it "should not return an error", ->
				@callback.calledWithExactly().should.equal true

			it "should not try to enable versioning again", ->
				@projectEntityHandler.flushProjectToThirdPartyDataStore.called.should.equal false
				@versioningApi.createProject.called.should.equal false
				@ProjectModel.update.called.should.equal false

