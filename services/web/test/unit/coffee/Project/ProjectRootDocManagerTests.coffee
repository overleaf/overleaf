chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Project/ProjectRootDocManager.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectRootDocManager', ->
	beforeEach ->
		@project_id = "project-123"
		@docPaths =
			"doc-id-1": "/chapter1.tex"
			"doc-id-2": "/main.tex"
			"doc-id-3": "/nested/chapter1a.tex"
			"doc-id-4": "/nested/chapter1b.tex"
		@sl_req_id = "sl-req-id-123"
		@callback = sinon.stub()
		@ProjectRootDocManager = SandboxedModule.require modulePath, requires:
			"./ProjectEntityHandler" : @ProjectEntityHandler = {}
			"./ProjectEntityUpdateHandler" : @ProjectEntityUpdateHandler = {}
			"./ProjectGetter" : @ProjectGetter = {}

	describe "setRootDocAutomatically", ->
		describe "when there is a suitable root doc", ->
			beforeEach (done)->
				@docs =
					"/chapter1.tex":
						_id: "doc-id-1"
						lines: ["something else","\\begin{document}", "Hello world", "\\end{document}"]
					"/main.tex":
						_id: "doc-id-2"
						lines: ["different line","\\documentclass{article}", "\\input{chapter1}"]
					"/nested/chapter1a.tex":
						_id: "doc-id-3"
						lines: ["Hello world"]
					"/nested/chapter1b.tex":
						_id: "doc-id-4"
						lines: ["Hello world"]

				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocs.calledWith(@project_id)
					.should.equal true

			it "should set the root doc to the doc containing a documentclass", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when the root doc is an Rtex file", ->
			beforeEach ->
				@docs =
					"/chapter1.tex":
						_id: "doc-id-1"
						lines: ["\\begin{document}", "Hello world", "\\end{document}"]
					"/main.Rtex":
						_id: "doc-id-2"
						lines: ["\\documentclass{article}", "\\input{chapter1}"]
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, @callback

			it "should set the root doc to the doc containing a documentclass", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when there is no suitable root doc", ->
			beforeEach (done)->
				@docs =
					"/chapter1.tex":
						_id: "doc-id-1"
						lines: ["\\begin{document}", "Hello world", "\\end{document}"]
					"/style.bst":
						_id: "doc-id-2"
						lines: ["%Example: \\documentclass{article}"]
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(1, null, @docs)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, done

			it "should not set the root doc to the doc containing a documentclass", ->
				@ProjectEntityUpdateHandler.setRootDoc.called.should.equal false

	describe "setRootDocFromName", ->
		describe "when there is a suitable root doc", ->
			beforeEach (done)->
				@docPaths =
					"doc-id-1": "/chapter1.tex"
					"doc-id-2": "/main.tex"
					"doc-id-3": "/nested/chapter1a.tex"
					"doc-id-4": "/nested/chapter1b.tex"
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, '/main.tex', done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocPathsFromProjectById.calledWith(@project_id)
					.should.equal true

			it "should set the root doc to main.tex", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when there is a suitable root doc but the leading slash is missing", ->
			beforeEach (done)->
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, 'main.tex', done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocPathsFromProjectById.calledWith(@project_id)
					.should.equal true

			it "should set the root doc to main.tex", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when there is a suitable root doc with a basename match", ->
			beforeEach (done)->
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, 'chapter1a.tex', done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocPathsFromProjectById.calledWith(@project_id)
					.should.equal true

			it "should set the root doc using the basename", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-3")
					.should.equal true

		describe "when there is a suitable root doc but the filename is in quotes", ->
			beforeEach (done)->
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, "'main.tex'", done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocPathsFromProjectById.calledWith(@project_id)
					.should.equal true

			it "should set the root doc to main.tex", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when there is no suitable root doc", ->
			beforeEach (done)->
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, "other.tex", done

			it "should not set the root doc", ->
				@ProjectEntityUpdateHandler.setRootDoc.called.should.equal false


	describe "ensureRootDocumentIsSet", ->
		beforeEach ->
			@project = {}
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)
			@ProjectRootDocManager.setRootDocAutomatically = sinon.stub().callsArgWith(1, null)

		describe "when the root doc is set", ->
			beforeEach ->
				@project.rootDoc_id = "root-doc-id"
				@ProjectRootDocManager.ensureRootDocumentIsSet(@project_id, @callback)

			it "should find the project fetching only the rootDoc_id field", ->
				@ProjectGetter.getProject
					.calledWith(@project_id, rootDoc_id: 1)
					.should.equal true

			it "should not try to update the project rootDoc_id", ->
				@ProjectRootDocManager.setRootDocAutomatically
					.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the root doc is not set", ->
			beforeEach ->
				@ProjectRootDocManager.ensureRootDocumentIsSet(@project_id, @callback)

			it "should find the project with only the rootDoc_id fiel", ->
				@ProjectGetter.getProject
					.calledWith(@project_id, rootDoc_id: 1)
					.should.equal true

			it "should update the project rootDoc_id", ->
				@ProjectRootDocManager.setRootDocAutomatically
					.calledWith(@project_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the project does not exist", ->
			beforeEach ->
				@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
				@ProjectRootDocManager.ensureRootDocumentIsSet(@project_id, @callback)

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("project not found")).should.equal true

	describe "ensureRootDocumentIsValid", ->
		beforeEach ->
			@project = {}
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @project)
			@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().yields()
			@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
			@ProjectRootDocManager.setRootDocAutomatically = sinon.stub().callsArgWith(1, null)

		describe "when the root doc is set", ->
			describe "when the root doc is valid", ->
				beforeEach ->
					@project.rootDoc_id = "doc-id-2"
					@ProjectRootDocManager.ensureRootDocumentIsValid(@project_id, @callback)

				it "should find the project fetching only the rootDoc_id field", ->
					@ProjectGetter.getProject
						.calledWith(@project_id, rootDoc_id: 1)
						.should.equal true

				it "should not try to update the project rootDoc_id", ->
					@ProjectRootDocManager.setRootDocAutomatically
						.called.should.equal false

				it "should call the callback", ->
					@callback.called.should.equal true

			describe "when the root doc is not valid", ->
				beforeEach ->
					@project.rootDoc_id = "bogus-doc-id"
					@ProjectRootDocManager.ensureRootDocumentIsValid(@project_id, @callback)

				it "should find the project fetching only the rootDoc_id field", ->
					@ProjectGetter.getProject
						.calledWith(@project_id, rootDoc_id: 1)
						.should.equal true

				it "should null the rootDoc_id field", ->
					@ProjectEntityUpdateHandler.setRootDoc
						.calledWith(@project_id, null)
						.should.equal true

				it "should try to find a new rootDoc", ->
					@ProjectRootDocManager.setRootDocAutomatically
						.called.should.equal true

				it "should call the callback", ->
					@callback.called.should.equal true

		describe "when the root doc is not set", ->
			beforeEach ->
				@ProjectRootDocManager.ensureRootDocumentIsSet(@project_id, @callback)

			it "should find the project fetching only the rootDoc_id fiel", ->
				@ProjectGetter.getProject
					.calledWith(@project_id, rootDoc_id: 1)
					.should.equal true

			it "should update the project rootDoc_id", ->
				@ProjectRootDocManager.setRootDocAutomatically
					.calledWith(@project_id)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "when the project does not exist", ->
			beforeEach ->
				@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, null)
				@ProjectRootDocManager.ensureRootDocumentIsSet(@project_id, @callback)

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("project not found")).should.equal true

