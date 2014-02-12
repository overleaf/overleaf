should = require('chai').should()
sinon = require('sinon')
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require("path")
modulePath = path.join __dirname, '../../../../app/js/Features/Versioning/AutomaticSnapshotManager'
tk = require 'timekeeper'
Settings = require "settings-sharelatex"

describe 'AutomaticSnapshotManager', ->
	beforeEach ->
		tk.freeze(Date.now())
		@project_id = "project-id-1234"
		@callback = sinon.stub()
		@rclient =
			auth:->
			del: sinon.stub().callsArg(2)
			srem: sinon.stub().callsArg(2)
			sadd: sinon.stub().callsArg(2)
			set: sinon.stub().callsArg(2)
		@VersioningApiHandler =
			takeSnapshot: sinon.stub().callsArg(2)
		@AutomaticSnapshotManager = SandboxedModule.require modulePath,
			requires:
				'redis' : createClient: () => @rclient
				'../../Features/Versioning/VersioningApiHandler' : @VersioningApiHandler
			globals:
				Date: Date
	
	afterEach -> tk.reset()

	describe "markProjectAsUpdated", ->
		beforeEach ->
			@AutomaticSnapshotManager.markProjectAsUpdated(@project_id, @callback)

		it "should update the project's last updated date", ->
			@rclient.set.calledWith("project_last_updated:#{@project_id}", Date.now())

		it "should add the project to the set needing processing", ->
			@rclient.sadd.calledWith("projects_to_snapshot", @project_id)

		it "should call the callback", ->
			@callback.calledWith().should.equal true
	
	describe "takeSnapshotIfRequired", ->
		beforeEach ->
			@lastUpdated = Date.now() - Settings.automaticSnapshots.waitTimeAfterLastEdit + 1
			@lastSnapshot = Date.now() - Settings.automaticSnapshots.maxTimeBetweenSnapshots + 1
			@rclient.get = (key, callback) =>
				if key == "project_last_updated:#{@project_id}"
					callback(null, @lastUpdated)
				else if key == "project_last_snapshot:#{@project_id}"
					callback(null, @lastSnapshot)
				else
					throw new Error("unexpected key: #{key}")

		describe "when updated longer than waitTimeAfterLastEdit ago", ->
			beforeEach ->
				@lastUpdated = Date.now() - Settings.automaticSnapshots.waitTimeAfterLastEdit - 1
				@AutomaticSnapshotManager.takeSnapshotIfRequired(@project_id, @callback)

			it "should take a snapshot", ->
				@VersioningApiHandler.takeSnapshot.calledWith(@project_id, "Automatic snapshot")
					.should.equal true

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true
	
		describe "when last snapshot longer then maxTimeBetweenSnapshots ago", ->
			beforeEach ->
				@lastSnapshot = Date.now() - Settings.automaticSnapshots.maxTimeBetweenSnapshots - 1
				@AutomaticSnapshotManager.takeSnapshotIfRequired(@project_id, @callback)
			
			it "should take a snapshot", ->
				@VersioningApiHandler.takeSnapshot.calledWith(@project_id, "Automatic snapshot")
					.should.equal true

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true

		describe "when no snapshot has been taken", ->
			beforeEach ->
				@lastSnapshot = null
				@AutomaticSnapshotManager.takeSnapshotIfRequired(@project_id, @callback)
			
			it "should take a snapshot", ->
				@VersioningApiHandler.takeSnapshot.calledWith(@project_id, "Automatic snapshot")
					.should.equal true

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true

		describe "when no snapshot is needed", ->
			beforeEach ->
				@AutomaticSnapshotManager.takeSnapshotIfRequired(@project_id, @callback)
			
			it "should take a snapshot", ->
				@VersioningApiHandler.takeSnapshot.called.should.equal false

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true
			
	describe "takeAutomaticSnapshots", ->
		beforeEach ->
			@project_ids = ["project-1", "project-2", "project-3"]
			@rclient.smembers = (key, callback) =>
				if key == "projects_to_snapshot"
					callback(null, @project_ids)
				else
					throw new Error("unexpected key: #{key}")
			sinon.stub(@AutomaticSnapshotManager, "takeSnapshotIfRequired")
				.callsArgWith(1)
			@AutomaticSnapshotManager.takeAutomaticSnapshots(@callback)

		afterEach ->
			@AutomaticSnapshotManager.takeSnapshotIfRequired.restore()

		it "should call takeSnapshotIfRequired for each project id", ->
			for project_id in @project_ids
				@AutomaticSnapshotManager.takeSnapshotIfRequired.calledWith(project_id)
					.should.equal true

		it "should call the callback", ->
			@callback.calledWith(null).should.equal true


	describe "removing project from marked set", ->
		beforeEach ->
			@AutomaticSnapshotManager.markProjectAsUpdated @project_id, =>
				@AutomaticSnapshotManager.unmarkProjectAsUpdated @project_id, @callback

		it "should update the project's last updated date", ->
			@rclient.del.calledWith("project_last_updated:#{@project_id}", Date.now())

		it "should add the project to the set needing processing", ->
			@rclient.srem.calledWith("projects_to_snapshot", @project_id)

		it "should call the callback", ->
			@callback.calledWith().should.equal true	
				
