SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsController.js'



describe 'TpdsController', ->
	beforeEach ->
		@TpdsUpdateHandler = {}
		@TpdsController = SandboxedModule.require modulePath, requires:
			'./TpdsUpdateHandler':@TpdsUpdateHandler
			'./UpdateMerger': @UpdateMerger = {}
			'logger-sharelatex':
				log:->
				err:->
		@user_id = "dsad29jlkjas"

	describe 'getting an update', ->

		it 'should process the update with the update reciver', (done)->
			path = "/projectName/here.txt"
			req =
				pause:->
				params:{0:path, "user_id":@user_id}
				session:
					destroy:->
				headers:
					"x-sl-update-source": @source = "dropbox"
			@TpdsUpdateHandler.newUpdate = sinon.stub().callsArg(5)
			res =  sendStatus: => 
				@TpdsUpdateHandler.newUpdate.calledWith(@user_id, "projectName","/here.txt", req, @source).should.equal true
				done()
			@TpdsController.mergeUpdate req, res

	describe 'getting a delete update', ->
		it 'should process the delete with the update reciver', (done)->
			path = "/projectName/here.txt"
			req = 
				params:{0:path, "user_id":@user_id}
				session:
					destroy:->
				headers:
					"x-sl-update-source": @source = "dropbox"
			@TpdsUpdateHandler.deleteUpdate = sinon.stub().callsArg(4)
			res = sendStatus: => 
				@TpdsUpdateHandler.deleteUpdate.calledWith(@user_id, "projectName", "/here.txt", @source).should.equal true
				done()
			@TpdsController.deleteUpdate req, res

	describe 'parseParams', ->

		it 'should take the project name off the start and replace with slash', ->
			path  = "noSlashHere"
			req = params:{0:path, user_id:@user_id}
			result = @TpdsController.parseParams(req)
			result.user_id.should.equal @user_id
			result.filePath.should.equal "/"
			result.projectName.should.equal path


		it 'should take the project name off the start and return it with no slashes in', ->
			path  = "/project/file.tex"
			req = params:{0:path, user_id:@user_id}
			result = @TpdsController.parseParams(req)
			result.user_id.should.equal @user_id
			result.filePath.should.equal "/file.tex"
			result.projectName.should.equal "project"

		it 'should take the project name of and return a slash for the file path', ->
			path = "/project_name"
			req = params:{0:path, user_id:@user_id}
			result = @TpdsController.parseParams(req)
			result.projectName.should.equal "project_name"
			result.filePath.should.equal "/"
			
	describe 'updateProjectContents', ->
		beforeEach ->
			@UpdateMerger.mergeUpdate = sinon.stub().callsArg(5)
			@req =
				params:
					0: @path = "chapters/main.tex"
					project_id: @project_id = "project-id-123"
				session:
					destroy: sinon.stub()
				headers:
					"x-sl-update-source": @source = "github"
			@res =
				sendStatus: sinon.stub()
			
			@TpdsController.updateProjectContents @req, @res
			
		it "should merge the update", ->
			@UpdateMerger.mergeUpdate
				.calledWith(null, @project_id, "/" + @path, @req, @source)
				.should.equal true
				
		it "should return a success", ->
			@res.sendStatus.calledWith(200).should.equal true

			
	describe 'deleteProjectContents', ->
		beforeEach ->
			@UpdateMerger.deleteUpdate = sinon.stub().callsArg(3)
			@req =
				params:
					0: @path = "chapters/main.tex"
					project_id: @project_id = "project-id-123"
				session:
					destroy: sinon.stub()
				headers:
					"x-sl-update-source": @source = "github"
			@res =
				sendStatus: sinon.stub()
			
			@TpdsController.deleteProjectContents @req, @res
			
		it "should delete the file", ->
			@UpdateMerger.deleteUpdate
				.calledWith(@project_id, "/" + @path, @source)
				.should.equal true
				
		it "should return a success", ->
			@res.sendStatus.calledWith(200).should.equal true

