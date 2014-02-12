should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, '../../../../app/js/Features/Templates/TemplatesController'


describe 'Templates Controller', ->

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
		@controller = SandboxedModule.require modulePath, requires:
			'../Uploads/ProjectUploadManager':@ProjectUploadManager
			'../Project/ProjectOptionsHandler':@ProjectOptionsHandler
			'./TemplatesPublisher':@TemplatesPublisher
			"logger-sharelatex": log:->
			"settings-sharelatex": 
				path:
					dumpFolder:@dumpFolder
				siteUrl: "http://localhost:3000"
			"node-uuid":v4:=>@uuid
			"request": @request
			"fs":@fs
		@zipUrl = "www.sharelatex.com/templates/cv/best.zip"
		@templateName = "project name here"
		@user_id = "1234"
		@req =
			session:
				user: _id:@user_id
				templateData: zipUrl: @zipUrl, templateName: @templateName
		@redirect = {}

	describe 'reciving a request to create project from templates.sharelatex.com', ->

		it 'should take the zip url and write it to disk', (done)->
			redirect = =>
				@ProjectUploadManager.createProjectFromZipArchive.calledWith(@user_id, @templateName, "#{@dumpFolder}/#{@uuid}").should.equal true
				@request.calledWith("http://#{@zipUrl}").should.equal true
				@fs.unlink.calledWith("#{@dumpFolder}/#{@uuid}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res



	describe 'reciving a request to create project from non specified domain', ->

		it 'should default to www.sharelatex.com', (done)->
			@zipUrl = "/templates/cv/different.zip"
			@req.session.templateData.zipUrl = @zipUrl
			redirect = =>
				@request.calledWith("http://www.sharelatex.com#{@zipUrl}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromZipTemplate @req, res

		it 'should use the different domain if specified', (done)->
			@zipUrl = "www.latextemplates.com/templates/cv/remote.zip"
			@req.session.templateData.zipUrl = @zipUrl
			redirect = =>
				@request.calledWith("http://#{@zipUrl}").should.equal true
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


	describe '', ->
