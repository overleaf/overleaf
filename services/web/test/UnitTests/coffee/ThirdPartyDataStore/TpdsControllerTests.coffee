SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../../app/js/Features/ThirdPartyDataStore/TpdsController.js'



describe 'third party data store', ->
	beforeEach ->
		@updateHandler = {}
		@controller = SandboxedModule.require modulePath, requires:
			'./TpdsUpdateHandler':@updateHandler
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
			@updateHandler.newUpdate = sinon.stub().callsArg(5)
			res =  send: => 
				@updateHandler.newUpdate.calledWith(@user_id, "projectName","/here.txt", req).should.equal true
				done()
			@controller.mergeUpdate req, res

	describe 'getting a delete update', ->
		it 'should process the delete with the update reciver', (done)->
			path = "/projectName/here.txt"
			req = 
				params:{0:path, "user_id":@user_id}
				session:
					destroy:->
			@updateHandler.deleteUpdate = sinon.stub().callsArg(4)
			res = send: => 
				@updateHandler.deleteUpdate.calledWith(@user_id, "projectName", "/here.txt").should.equal true
				done()
			@controller.deleteUpdate req, res

	describe 'parseParams', ->

		it 'should take the project name off the start and replace with slash', ->
			path  = "noSlashHere"
			req = params:{0:path, user_id:@user_id}
			result = @controller.parseParams(req)
			result.user_id.should.equal @user_id
			result.filePath.should.equal "/"
			result.projectName.should.equal path


		it 'should take the project name off the start and return it with no slashes in', ->
			path  = "/project/file.tex"
			req = params:{0:path, user_id:@user_id}
			result = @controller.parseParams(req)
			result.user_id.should.equal @user_id
			result.filePath.should.equal "/file.tex"
			result.projectName.should.equal "project"

		it 'should take the project name of and return a slash for the file path', ->
			path = "/project_name"
			req = params:{0:path, user_id:@user_id}
			result = @controller.parseParams(req)
			result.projectName.should.equal "project_name"
			result.filePath.should.equal "/"


