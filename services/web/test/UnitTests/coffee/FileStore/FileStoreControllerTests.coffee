assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/FileStore/FileStoreController.js"
SandboxedModule = require('sandboxed-module')

describe "FileStoreController", ->

	beforeEach ->
		@FileStoreHandler =
			getFileStream: sinon.stub()
		@ProjectLocator =
			findElement: sinon.stub()
		@controller = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex" : @logger = {log:sinon.stub(), err:sinon.stub()}
			"../Project/ProjectLocator": @ProjectLocator
			"./FileStoreHandler": @FileStoreHandler
		@stream = {}
		@project_id = "2k3j1lk3j21lk3j"
		@file_id = "12321kklj1lk3jk12"
		@req =
			params:
				Project_id: @project_id
				File_id: @file_id
			query: "query string here"
			get: (key) -> undefined
		@res =
			setHeader: sinon.stub()
		@file =
			name: "myfile.png"

	describe "getFile", ->

		beforeEach ->
			@FileStoreHandler.getFileStream.callsArgWith(3, null, @stream)
			@ProjectLocator.findElement.callsArgWith(1, null, @file)

		it "should call the file store handler with the project_id file_id and any query string", (done)->
			@stream.pipe = (des)=>
				@FileStoreHandler.getFileStream.calledWith(@req.params.Project_id, @req.params.File_id, @req.query).should.equal true
				done()
			@controller.getFile @req, @res

		it "should pipe to res", (done)->
			@stream.pipe = (des)=>
				des.should.equal @res
				done()
			@controller.getFile @req, @res

		it "should get the file from the db", (done)->
			@stream.pipe = (des)=>
				opts =
					project_id: @project_id
					element_id: @file_id
					type: "file"
				@ProjectLocator.findElement.calledWith(opts).should.equal true
				done()
			@controller.getFile @req, @res

		it "should set the Content-Disposition header", (done)->
			@stream.pipe = (des)=>
				@res.setHeader.calledWith("Content-Disposition", "attachment; filename=#{@file.name}").should.equal true
				done()
			@controller.getFile @req, @res

		# Test behaviour around handling html files
		['.html', '.htm', '.xhtml'].forEach (extension) ->
			describe "with a '#{extension}' file extension", ->

				beforeEach ->
					@user_agent = 'A generic browser'
					@file.name = "bad#{extension}"
					@req.get = (key) =>
						if key == 'User-Agent'
							@user_agent

				describe "from a non-ios browser", ->

					it "should not set Content-Type", (done) ->
						@stream.pipe = (des) =>
							@res.setHeader.calledWith("Content-Type", "text/plain").should.equal false
							done()
						@controller.getFile @req, @res

				describe "from an iPhone", ->

					beforeEach ->
						@user_agent = "An iPhone browser"

					it "should set Content-Type to 'text/plain'", (done) ->
						@stream.pipe = (des) =>
							@res.setHeader.calledWith("Content-Type", "text/plain").should.equal true
							done()
						@controller.getFile @req, @res

				describe "from an iPad", ->

					beforeEach ->
						@user_agent = "An iPad browser"

					it "should set Content-Type to 'text/plain'", (done) ->
						@stream.pipe = (des) =>
							@res.setHeader.calledWith("Content-Type", "text/plain").should.equal true
							done()
						@controller.getFile @req, @res

		# None of these should trigger the iOS/html logic
		['x.html-is-rad', 'html.pdf', 'bare'].forEach (filename) ->
			describe "with filename as '#{filename}'", ->

				beforeEach ->
					@user_agent = 'A generic browser'
					@file.name = filename
					@req.get = (key) =>
						if key == 'User-Agent'
							@user_agent

				['iPhone', 'iPad', 'Firefox', 'Chrome'].forEach (browser) ->
					describe "downloaded from #{browser}", ->
						beforeEach ->
							@user_agent = "Some #{browser} thing"

						it 'Should not set the Content-type', (done) ->
							@stream.pipe = (des) =>
								@res.setHeader.calledWith("Content-Type", "text/plain").should.equal false
								done()
							@controller.getFile @req, @res
