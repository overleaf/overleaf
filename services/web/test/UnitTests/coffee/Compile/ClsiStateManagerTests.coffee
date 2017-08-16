sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Compile/ClsiStateManager.js"
SandboxedModule = require('sandboxed-module')

describe "ClsiStateManager", ->
	beforeEach ->
		@ClsiStateManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings = {}
			"../Project/ProjectEntityHandler": @ProjectEntityHandler = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }
		@project = "project"
		@callback = sinon.stub()

	describe "computeHash", ->
		beforeEach (done) ->
			@docs = [
				{path: "/main.tex", doc: {_id: "doc-id-1"}}
				{path: "/folder/sub.tex", doc: {_id: "doc-id-2"}}
			]
			@files = [
				{path: "/figure.pdf", file: {_id: "file-id-1", rev: 123, created: "aaaaaa"}}
				{path: "/folder/fig2.pdf", file: {_id: "file-id-2", rev: 456, created: "bbbbbb"}}
			]
			@ProjectEntityHandler.getAllEntitiesFromProject = sinon.stub().callsArgWith(1, null, @docs, @files)
			@ClsiStateManager.computeHash @project, (err, hash) =>
				@hash0 = hash
				done()

		describe "with a sample project", ->
			beforeEach ->
				@ClsiStateManager.computeHash @project, @callback

			it "should call the callback with a hash value", ->
				@callback
					.calledWith(null, "9c2c2428e4147db63cacabf6f357af483af6551d")
					.should.equal true

		describe "when the files and docs are in a different order", ->
			beforeEach ->
				[@docs[0], @docs[1]] = [@docs[1], @docs[0]]
				[@files[0], @files[1]] = [@files[1], @files[0]]
				@ClsiStateManager.computeHash @project, @callback

			it "should call the callback with the same hash value", ->
				@callback
					.calledWith(null, @hash0)
					.should.equal true

		describe "when a doc is renamed", ->
			beforeEach (done) ->
				@docs[0].path = "/new.tex"
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a file is renamed", ->
			beforeEach (done) ->
				@files[0].path = "/newfigure.pdf"
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a doc is added", ->
			beforeEach (done) ->
				@docs.push { path: "/newdoc.tex", doc: {_id: "newdoc-id"}}
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a file is added", ->
			beforeEach (done) ->
				@files.push { path: "/newfile.tex", file: {_id: "newfile-id", rev: 123}}
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a doc is removed", ->
			beforeEach (done) ->
				@docs.pop()
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a file is removed", ->
			beforeEach (done) ->
				@files.pop()
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

		describe "when a file's revision is updated", ->
			beforeEach (done) ->
				@files[0].file.rev++
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true


		describe "when a file's date is updated", ->
			beforeEach (done) ->
				@files[0].file.created = "zzzzzz"
				@ClsiStateManager.computeHash @project, (err, hash) =>
					@hash1 = hash
					done()

			it "should call the callback with a different hash value", ->
				@callback
					.neverCalledWith(null, @hash0)
					.should.equal true

