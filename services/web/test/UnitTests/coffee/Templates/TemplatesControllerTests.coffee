should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, '../../../../app/js/Features/Templates/TemplatesController'


describe 'TemplatesController', ->

	project_id = "213432"

	beforeEach ->
		@request = sinon.stub()
		@request.returns {
			pipe:->
			on:->
		}
		@fs = {
			unlink : sinon.stub()
			createWriteStream : sinon.stub().returns(on:(_, cb)->cb())
		}
		@ProjectUploadManager = {createProjectFromZipArchive : sinon.stub().callsArgWith(3, null, {_id:project_id})}
		@dumpFolder = "dump/path"
		@ProjectOptionsHandler = {setCompiler:sinon.stub().callsArgWith(2)}
		@uuid = "1234"
		@TemplatesPublisher = 
			publish: sinon.stub()
			unpublish:sinon.stub()
			getTemplateDetails: sinon.stub()
		@ProjectDetailsHandler =
			getProjectDescription:sinon.stub()
		@controller = SandboxedModule.require modulePath, requires:
			'../Uploads/ProjectUploadManager':@ProjectUploadManager
			'../Project/ProjectOptionsHandler':@ProjectOptionsHandler
			'../Project/ProjectDetailsHandler':@ProjectDetailsHandler
			'../Project/ProjectGetter':@ProjectGetter = {}
			'../Editor/EditorController': @EditorController = {}
			'./TemplatesPublisher':@TemplatesPublisher
			"logger-sharelatex": 
				log:->
				err:->
			"settings-sharelatex": 
				path:
					dumpFolder:@dumpFolder
				siteUrl: "http://localhost:3000"
				apis:
					templates:
						url: @templateApiUrl="http://templates.sharelatex.env"
					web:
						url: @webApiUrl="http://web-api.sharelatex.env"
			"node-uuid":v4:=>@uuid
			"request": @request
			"fs":@fs
		@zipUrl = "%2Ftemplates%2F52fb86a81ae1e566597a25f6%2Fv%2F4%2Fzip&templateName=Moderncv%20Banking&compiler=pdflatex"
		@templateName = "project name here"
		@user_id = "1234"
		@req =
			session:
				user: _id:@user_id
				templateData: 
					zipUrl: @zipUrl
					templateName: @templateName
		@redirect = {}

	describe 'reciving a request to create project from templates.sharelatex.com', ->

		it 'should take the zip url and write it to disk', (done)->
			redirect = =>
				@ProjectUploadManager.createProjectFromZipArchive.calledWith(@user_id, @templateName, "#{@dumpFolder}/#{@uuid}").should.equal true
				@request.calledWith("#{@templateApiUrl}#{@zipUrl}").should.equal true
				@fs.unlink.calledWith("#{@dumpFolder}/#{@uuid}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res


		it "should go to the web api if the url does not contain templates", (done)->
			@req.session.templateData.zipUrl = @zipUrl = "/project/52fd24abf080d80a22000fbd/download/zip&templateName=Example_Project&compiler=xelatex"
			redirect = =>
				@request.calledWith("#{@webApiUrl}#{@zipUrl}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res

		it "should go to the web api if the url has template futher down the string", (done)->
			@req.session.templateData.zipUrl = @zipUrl = "/project/52fd24abf080d80a22000fbd/download/zip&templateName=templates&compiler=xelatex"
			redirect = =>
				@request.calledWith("#{@webApiUrl}#{@zipUrl}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res

	describe 'publishProject', ->
		beforeEach ->
			@user_id = "user-id-123"
			@project_id = "project-id-123"
			@res =
				send: sinon.stub()
			@req.params =
				Project_id: @project_id
				
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, {owner_ref: @user_id})
			@TemplatesPublisher.publish = sinon.stub().callsArgWith(2)
			@controller.publishProject @req, @res
			
		it "should look up the project owner", ->
			@ProjectGetter.getProject
				.calledWith(@project_id, { owner_ref: 1 })
				.should.equal true
				
		it "should publish the template", ->
			@TemplatesPublisher.publish
				.calledWith(@user_id, @project_id)
				.should.equal true
				
		it "should return a success status", ->
			@res.send.calledWith(204).should.equal true

	describe 'unpublishProject', ->
		beforeEach ->
			@user_id = "user-id-123"
			@project_id = "project-id-123"
			@res =
				send: sinon.stub()
			@req.params =
				Project_id: @project_id
				
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, {owner_ref: @user_id})
			@TemplatesPublisher.unpublish = sinon.stub().callsArgWith(2)
			@controller.unpublishProject @req, @res
			
		it "should look up the project owner", ->
			@ProjectGetter.getProject
				.calledWith(@project_id, { owner_ref: 1 })
				.should.equal true
				
		it "should publish the template", ->
			@TemplatesPublisher.unpublish
				.calledWith(@user_id, @project_id)
				.should.equal true
				
		it "should return a success status", ->
			@res.send.calledWith(204).should.equal true

	describe 'settings the compiler from the query string', ->
		it 'should use the said compiler', (done)->
			@req.session.templateData.compiler = "xelatex"
			redirect = =>
				@ProjectOptionsHandler.setCompiler.calledWith(project_id, "xelatex").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res

		it 'should not call the options handler if there is not set compiler', (done)->
			redirect = =>
				@ProjectOptionsHandler.setCompiler.called.should.equal false
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res

	describe "updateProjectDescription", ->
		beforeEach ->
			@EditorController.updateProjectDescription = sinon.stub().callsArg(2)
			@res =
				send: sinon.stub()
			@req.params =
				Project_id: @project_id = "project-id-123"
			@req.body =
				description: @description = "test description"
				
			@controller.updateProjectDescription @req, @res
			
		it "should update the project description", ->
			@EditorController.updateProjectDescription
				.calledWith(@project_id, @description)
				.should.equal true
				
		it "should return a success code", ->
			@res.send.calledWith(204).should.equal true

	describe 'getTemplateDetails', ->
		beforeEach ->
			@user_id = "user-id-123"
			@project_id = "project-id-123"
			@res =
				json: sinon.stub()
			@req.params =
				Project_id: @project_id
				
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, {owner_ref: @user_id})
			@TemplatesPublisher.getTemplateDetails.callsArgWith(2, null, @details = {exists: true})
			@ProjectDetailsHandler.getProjectDescription.callsArgWith(1, null, @description = "test description")
			
			@controller.getTemplateDetails @req, @res

		it "should get the template details for the user_id and project_id", ->
			@TemplatesPublisher.getTemplateDetails
				.calledWith(@user_id, @project_id)
				.should.equal true
				
		it "should return the details and description", ->
			@res.json
				.calledWith({
					exists: @details.exists
					description: @description
				})
				.should.equal true

