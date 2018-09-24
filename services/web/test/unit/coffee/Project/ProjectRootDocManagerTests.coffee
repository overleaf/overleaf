chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Project/ProjectRootDocManager.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectRootDocManager', ->
	beforeEach ->
		@project_id = "project-123"
		@sl_req_id = "sl-req-id-123"
		@callback = sinon.stub()
		@ProjectRootDocManager = SandboxedModule.require modulePath, requires:
			"./ProjectEntityHandler" : @ProjectEntityHandler = {}
			"./ProjectEntityUpdateHandler" : @ProjectEntityUpdateHandler = {}
	
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
				@docPaths =
					"doc-id-1": "/chapter1.tex"
					"doc-id-2": "/main.tex"
					"doc-id-3": "/nested/chapter1a.tex"
					"doc-id-4": "/nested/chapter1b.tex"
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
				@docPaths =
					"doc-id-1": "/chapter1.tex"
					"doc-id-2": "/main.tex"
					"doc-id-3": "/nested/chapter1a.tex"
					"doc-id-4": "/nested/chapter1b.tex"
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, 'chapter1a.tex', done

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocPathsFromProjectById.calledWith(@project_id)
					.should.equal true

			it "should set the root doc using the basename", ->
				@ProjectEntityUpdateHandler.setRootDoc.calledWith(@project_id, "doc-id-3")
					.should.equal true

		describe "when there is no suitable root doc", ->
			beforeEach (done)->
				@docPaths =
					"doc-id-1": "/chapter1.tex"
					"doc-id-2": "/main.tex"
					"doc-id-3": "/nested/chapter1a.tex"
					"doc-id-4": "/nested/chapter1b.tex"
				@ProjectEntityHandler.getAllDocPathsFromProjectById = sinon.stub().callsArgWith(1, null, @docPaths)
				@ProjectEntityUpdateHandler.setRootDoc = sinon.stub().callsArgWith(2)
				@ProjectRootDocManager.setRootDocFromName @project_id, "other.tex", done

			it "should not set the root doc", ->
				@ProjectEntityUpdateHandler.setRootDoc.called.should.equal false
