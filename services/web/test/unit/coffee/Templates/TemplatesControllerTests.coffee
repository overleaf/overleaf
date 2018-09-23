should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = '../../../../app/js/Features/Templates/TemplatesController'


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
		@ProjectOptionsHandler = {
			setCompiler:sinon.stub().callsArgWith(2)
			setImageName:sinon.stub().callsArgWith(2)
		}
		@uuid = "1234"
		@ProjectDetailsHandler =
			getProjectDescription:sinon.stub()
		@Project =
			update: sinon.stub().callsArgWith(3, null)
		@controller = SandboxedModule.require modulePath, requires:
			'../../../js/Features/Uploads/ProjectUploadManager':@ProjectUploadManager
			'../../../js/Features/Project/ProjectOptionsHandler':@ProjectOptionsHandler
			'../../../js/Features/Authentication/AuthenticationController': @AuthenticationController = {getLoggedInUserId: sinon.stub()}
			'./TemplatesPublisher':@TemplatesPublisher
			"logger-sharelatex":
				log:->
				err:->
			"settings-sharelatex":
				path:
					dumpFolder:@dumpFolder
				siteUrl: @siteUrl = "http://localhost:3000"
				apis:
					v1:
						url: @v1Url="http://overleaf.com"
						user: "sharelatex"
						pass: "password"
				overleaf:
					host: @v1Url
			"uuid":v4:=>@uuid
			"request": @request
			"fs":@fs
			"../../../../app/js/models/Project": {Project: @Project}
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
		@AuthenticationController.getLoggedInUserId.returns(@user_id)

	describe 'v1Templates', ->

		it "should fetch zip from v1 based on template id", (done)->
			@templateVersionId = 15
			@req.body = {templateVersionId: @templateVersionId}

			redirect = =>
				@request.calledWith("#{@v1Url}/api/v1/sharelatex/templates/#{@templateVersionId}").should.equal true
				done()
			res = redirect:redirect
			@controller.createProjectFromV1Template @req, res
