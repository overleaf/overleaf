chai = require('chai')
should = chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Project/ProjectRootDocManager.js"
SandboxedModule = require('sandboxed-module')

describe 'ProjectRootDocManager', ->
	beforeEach ->
		@project_id = "project-123"
		@sl_req_id = "sl-req-id-123"
		@ProjectRootDocManager = SandboxedModule.require modulePath, requires:
			"./ProjectEntityHandler" : @ProjectEntityHandler = {}
	
	describe "setRootDocAutomatically", ->
		describe "when there is a suitable root doc", ->
			beforeEach ->
				@docs =
					"/chapter1.tex":
						_id: "doc-id-1"
						lines: ["\\begin{document}", "Hello world", "\\end{document}"]
					"/main.tex":
						_id: "doc-id-2"
						lines: ["\\documentclass{article}", "\\input{chapter1}"]
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(2, null, @docs)
				@ProjectEntityHandler.setRootDoc = sinon.stub().callsArgWith(3)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, @sl_req_id, @callback

			it "should check the docs of the project", ->
				@ProjectEntityHandler.getAllDocs.calledWith(@project_id)
					.should.equal true

			it "should set the root doc to the doc containing a documentclass", ->
				@ProjectEntityHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should pass on the sl_req_id", ->
				@ProjectEntityHandler.getAllDocs.calledWith(sinon.match.any, @sl_req_id)
					.should.equal true
				@ProjectEntityHandler.setRootDoc.calledWith(sinon.match.any, sinon.match.any, @sl_req_id)
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
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(2, null, @docs)
				@ProjectEntityHandler.setRootDoc = sinon.stub().callsArgWith(3)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, @sl_req_id, @callback

			it "should set the root doc to the doc containing a documentclass", ->
				@ProjectEntityHandler.setRootDoc.calledWith(@project_id, "doc-id-2")
					.should.equal true

		describe "when there is no suitable root doc", ->
			beforeEach ->
				@docs =
					"/chapter1.tex":
						_id: "doc-id-1"
						lines: ["\\begin{document}", "Hello world", "\\end{document}"]
					"/style.bst":
						_id: "doc-id-2"
						lines: ["%Example: \\documentclass{article}"]
				@ProjectEntityHandler.getAllDocs = sinon.stub().callsArgWith(2, null, @docs)
				@ProjectEntityHandler.setRootDoc = sinon.stub().callsArgWith(3)
				@ProjectRootDocManager.setRootDocAutomatically @project_id, @callback

			it "should not set the root doc to the doc containing a documentclass", ->
				@ProjectEntityHandler.setRootDoc.called.should.equal false

			it "should call the callback", ->
				@callback.called.should.equal true

