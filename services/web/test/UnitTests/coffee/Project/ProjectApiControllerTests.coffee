should = require('chai').should()
modulePath = "../../../../app/js/Features/Project/ProjectApiController"
SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()

describe 'Project api controller', ->

	beforeEach ->
		@ProjectDetailsHandler = 
			getDetails : sinon.stub()
		@controller = SandboxedModule.require modulePath, requires:
			"./ProjectDetailsHandler":@ProjectDetailsHandler
			'logger-sharelatex':
				log:->
		@project_id = "321l3j1kjkjl"
		@req = 
			params: 
				project_id:@project_id
			session:
				destroy:sinon.stub()
		@res = {}
		@projDetails = {name:"something"}


	describe "getProjectDetails", ->

		it "should ask the project details handler for proj details", (done)->
			@ProjectDetailsHandler.getDetails.callsArgWith(1, null, @projDetails)
			@res.json = (data)=>
				@ProjectDetailsHandler.getDetails.calledWith(@project_id).should.equal true
				data.should.deep.equal @projDetails
				done()
			@controller.getProjectDetails @req, @res


		it "should send a 500 if there is an error", (done)->
			@ProjectDetailsHandler.getDetails.callsArgWith(1, "error")
			@res.send = (resCode)=>
				resCode.should.equal 500
				done()
			@controller.getProjectDetails @req, @res
