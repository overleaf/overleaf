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
		@request.returns pipe:->
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
			'./TemplatesPublisher':@TemplatesPublisher
			"logger-sharelatex": 
				log:->
				err:->
			"settings-sharelatex": 
				path:
					dumpFolder:@dumpFolder
				siteUrl: "http://localhost:3000"
				apis:
					templates_api:
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

	describe 'publishProject', (done)->
		beforeEach ->
			@user_id = "sdijdlsakjlkajdklaj"
			@project_id = "23213kl2j13lk1"

		it 'should pass the user id and project id to the handler', (done)->
			@TemplatesPublisher.publish.callsArgWith(2)
			@controller.publishProject @user_id, @project_id, =>
				@TemplatesPublisher.publish.calledWith(@user_id, @project_id).should.equal true
				done()

		it 'should pass the error back', (done)->
			error = "error"
			@TemplatesPublisher.publish.callsArgWith(2, error)
			@controller.publishProject @user_id, @project_id, (passedError)=>
				passedError.should.equal error
				done()

	describe 'unpublish Project', (done)->
		beforeEach ->
			@user_id = "sdijdlsakjlkajdklaj"
			@project_id = "23213kl2j13lk1"

		it 'should pass the user id and project id to the handler', (done)->
			@TemplatesPublisher.unpublish.callsArgWith(2)
			@controller.unPublishProject @user_id, @project_id, =>
				@TemplatesPublisher.unpublish.calledWith(@user_id, @project_id).should.equal true
				done()

		it 'should pass the error back', (done)->
			error = "error"
			@TemplatesPublisher.unpublish.callsArgWith(2, error)
			@controller.unPublishProject @user_id, @project_id, (passedError)=>
				passedError.should.equal error
				done()


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


	describe 'getTemplateDetails', ->
		beforeEach ->
			@description = "this project is nice"
			@ProjectDetailsHandler.getProjectDescription.callsArgWith(1, null, @description)

		it "should return an error the templatePublisher", (done)->
			error = "error"
			@TemplatesPublisher.getTemplateDetails.callsArgWith(2, error)
			@controller.getTemplateDetails @user_id, @project_id, (passedError)=>
				passedError.should.equal error
				done()

		it "should return the details", (done)->
			details = {exists:true}
			@TemplatesPublisher.getTemplateDetails.callsArgWith(2, null, details)
			@controller.getTemplateDetails @user_id, @project_id, (err, passedDetails)=>
				details.should.equal passedDetails
				done()

		it "should get the template description", (done)->
			@TemplatesPublisher.getTemplateDetails.callsArgWith(2, null, {})
			@controller.getTemplateDetails @user_id, @project_id, (err, passedDetails)=>
				passedDetails.description.should.equal @description
				done()

