should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/InactiveData/InactiveProjectManager"
expect = require("chai").expect

describe "InactiveProjectManager", ->

	beforeEach ->

		@settings = {}
		@DocstoreManager =
			unarchiveProject:sinon.stub()
			archiveProject:sinon.stub()
		@ProjectUpdateHandler = 
			markAsActive:sinon.stub()
			markAsInactive:sinon.stub()
		@ProjectGetter = 
			getProject:sinon.stub()
		@TrackChangesManager =
			archiveProject:sinon.stub()
		@InactiveProjectManager = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				err:->
			"../Docstore/DocstoreManager":@DocstoreManager
			"../Project/ProjectUpdateHandler":@ProjectUpdateHandler
			"../Project/ProjectGetter":@ProjectGetter
			"../TrackChanges/TrackChangesManager":@TrackChangesManager
		@project_id = "1234"

	describe "reactivateProjectIfRequired", ->

		beforeEach ->
			@project = {active:false}
			@ProjectGetter.getProject.callsArgWith(2, null, @project)
			@ProjectUpdateHandler.markAsActive.callsArgWith(1)

		it "should call unarchiveProject", (done)->
			@DocstoreManager.unarchiveProject.callsArgWith(1)
			@InactiveProjectManager.reactivateProjectIfRequired @project_id, (err)=>
				@DocstoreManager.unarchiveProject.calledWith(@project_id).should.equal true
				@ProjectUpdateHandler.markAsActive.calledWith(@project_id).should.equal true
				done()

		it "should not mark project as active if error with unarchinging", (done)->
			@DocstoreManager.unarchiveProject.callsArgWith(1, "error")
			@InactiveProjectManager.reactivateProjectIfRequired @project_id, (err)=>
				err.should.equal "error"
				@DocstoreManager.unarchiveProject.calledWith(@project_id).should.equal true
				@ProjectUpdateHandler.markAsActive.calledWith(@project_id).should.equal false
				done()


		it "should not call unarchiveProject if it is active", (done)->
			@project.active = true
			@DocstoreManager.unarchiveProject.callsArgWith(1)
			@InactiveProjectManager.reactivateProjectIfRequired @project_id, (err)=>
				@DocstoreManager.unarchiveProject.calledWith(@project_id).should.equal false
				@ProjectUpdateHandler.markAsActive.calledWith(@project_id).should.equal false
				done()


	describe "deactivateProject", ->

		it "should call unarchiveProject and markAsInactive", (done)->
			@DocstoreManager.archiveProject.callsArgWith(1)
			@TrackChangesManager.archiveProject.callsArgWith(1)

			@ProjectUpdateHandler.markAsInactive.callsArgWith(1)

			@InactiveProjectManager.deactivateProject @project_id, (err)=>
				@DocstoreManager.archiveProject.calledWith(@project_id).should.equal true
				@TrackChangesManager.archiveProject.calledWith(@project_id).should.equal true
				@ProjectUpdateHandler.markAsInactive.calledWith(@project_id).should.equal true
				done()

		it "should not call markAsInactive if there was a problem archiving in docstore", (done)->
			@DocstoreManager.archiveProject.callsArgWith(1, "errorrr")
			@TrackChangesManager.archiveProject.callsArgWith(1)

			@ProjectUpdateHandler.markAsInactive.callsArgWith(1)

			@InactiveProjectManager.deactivateProject @project_id, (err)=>
				err.should.equal "errorrr"
				@DocstoreManager.archiveProject.calledWith(@project_id).should.equal true
				@ProjectUpdateHandler.markAsInactive.calledWith(@project_id).should.equal false
				done()


		it "should not call markAsInactive if there was a problem archiving in track changes", (done)->
			@DocstoreManager.archiveProject.callsArgWith(1)
			@TrackChangesManager.archiveProject.callsArgWith(1, "errorrr")

			@ProjectUpdateHandler.markAsInactive.callsArgWith(1)

			@InactiveProjectManager.deactivateProject @project_id, (err)=>
				err.should.equal "errorrr"
				@DocstoreManager.archiveProject.calledWith(@project_id).should.equal true
				@ProjectUpdateHandler.markAsInactive.calledWith(@project_id).should.equal false
				done()
