SandboxedModule = require('sandboxed-module')
assert = require('assert')
chai = require('chai')
sinon = require('sinon')
sinonChai = require('sinon-chai')

should = require('chai').should()
chai.use(sinonChai)

modulePath = '../../../../app/js/Features/Templates/TemplatesManager'

describe 'TemplatesManager', ->

	beforeEach ->
		@project_id = "project-id"
		@brandVariationId = "brand-variation-id"
		@compiler = "pdflatex"
		@imageName = "TL2017"
		@mainFile = "main.tex"
		@templateId = "template-id"
		@templateName = "template name"
		@templateVersionId = "template-version-id"
		@user_id = "user-id"
		@dumpPath = "#{@dumpFolder}/#{@uuid}"
		@callback = sinon.stub()
		@request = sinon.stub().returns {
			pipe:->
			on:->
			response: statusCode: 200
		}
		@fs = {
			unlink : sinon.stub()
			createWriteStream : sinon.stub().returns(on: sinon.stub().yields())
		}
		@ProjectUploadManager = {createProjectFromZipArchiveWithName : sinon.stub().callsArgWith(3, null, {_id:@project_id})}
		@dumpFolder = "dump/path"
		@ProjectOptionsHandler = {
			setCompiler:sinon.stub().callsArgWith(2)
			setImageName:sinon.stub().callsArgWith(2)
			setBrandVariationId:sinon.stub().callsArgWith(2)
		}
		@uuid = "1234"
		@ProjectRootDocManager = {
			setRootDocFromName: sinon.stub().callsArgWith(2)
		}
		@ProjectDetailsHandler =
			getProjectDescription:sinon.stub()
			fixProjectName: sinon.stub().returns(@templateName)
		@Project =
			update: sinon.stub().callsArgWith(3, null)
		@FileWriter =
			ensureDumpFolderExists: sinon.stub().callsArg(0)
		@TemplatesManager = SandboxedModule.require modulePath, requires:
			'../../../js/Features/Uploads/ProjectUploadManager':@ProjectUploadManager
			'../../../js/Features/Project/ProjectOptionsHandler':@ProjectOptionsHandler
			'../../../js/Features/Project/ProjectRootDocManager':@ProjectRootDocManager
			'../../../js/Features/Project/ProjectDetailsHandler':@ProjectDetailsHandler
			'../../../js/Features/Authentication/AuthenticationController': @AuthenticationController = {getLoggedInUserId: sinon.stub()}
			'../../infrastructure/FileWriter': @FileWriter
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
			"../../../js/models/Project": {Project: @Project}
		@zipUrl = "%2Ftemplates%2F52fb86a81ae1e566597a25f6%2Fv%2F4%2Fzip&templateName=Moderncv%20Banking&compiler=pdflatex"

	describe 'createProjectFromV1Template', ->

		describe "when all options passed", ->
			beforeEach ->
				@TemplatesManager.createProjectFromV1Template @brandVariationId, @compiler, @mainFile, @templateId, @templateName, @templateVersionId, @user_id, @imageName, @callback

			it "should fetch zip from v1 based on template id", ->
				@request.should.have.been.calledWith "#{@v1Url}/api/v1/sharelatex/templates/#{@templateVersionId}"

			it "should save temporary file", ->
				@fs.createWriteStream.should.have.been.calledWith @dumpPath

			it "should create project", ->
				@ProjectUploadManager.createProjectFromZipArchiveWithName.should.have.been.calledWithMatch @user_id, @templateName, @dumpPath

			it "should unlink file", ->
				@fs.unlink.should.have.been.calledWith @dumpPath

			it "should set project options when passed", ->
				@ProjectOptionsHandler.setCompiler.should.have.been.calledWithMatch @project_id, @compiler
				@ProjectOptionsHandler.setImageName.should.have.been.calledWithMatch @project_id, @imageName
				@ProjectRootDocManager.setRootDocFromName.should.have.been.calledWithMatch @project_id, @mainFile
				@ProjectOptionsHandler.setBrandVariationId.should.have.been.calledWithMatch @project_id, @brandVariationId

			it "should update project", ->
				@Project.update.should.have.been.calledWithMatch { _id: @project_id }, { fromV1TemplateId: @templateId, fromV1TemplateVersionId: @templateVersionId }

			it "should ensure that the dump folder exists", ->
				sinon.assert.called(@FileWriter.ensureDumpFolderExists)

		describe "when some options not set", ->
			beforeEach ->
				@TemplatesManager.createProjectFromV1Template null, null, null, @templateId, @templateName, @templateVersionId, @user_id, null, @callback

			it "should not set missing project options", ->
				@ProjectOptionsHandler.setCompiler.called.should.equal false
				@ProjectRootDocManager.setRootDocFromName.called.should.equal false
				@ProjectOptionsHandler.setBrandVariationId.called.should.equal false
				@ProjectOptionsHandler.setImageName.should.have.been.calledWithMatch @project_id, "wl_texlive:2018.1"
