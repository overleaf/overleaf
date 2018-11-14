ObjectId = require("mongojs").ObjectId
Path = require "path"
SandboxedModule = require "sandboxed-module"
assert = require "assert"
chai = require "chai"
sinon = require "sinon"
sinonChai = require "sinon-chai"

chai.use sinonChai
expect = chai.expect

modulePath = Path.join __dirname, "../../../../app/js/Features/Project/ProjectCollabratecDetailsHandler"

describe "ProjectCollabratecDetailsHandler", ->
	beforeEach ->
		@ProjectModel = {}
		@ProjectCollabratecDetailsHandler = SandboxedModule.require modulePath, requires:
			"../../models/Project": { Project: @ProjectModel }
		@callback = sinon.stub()

	describe "initializeCollabratecProject", ->

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.initializeCollabratecProject "project-id", "name", "user-id", "collabratec-document-id", "collabratec-private-group-id", @callback

			it "should update project model", ->
				update = $set: {
					name: "name",
					collabratecUsers: [ {
						user_id: "user-id",
						collabratec_document_id: "collabratec-document-id",
						collabratec_privategroup_id: "collabratec-private-group-id"
					} ]
				}
				expect(@ProjectModel.update).to.have.been.calledWith { _id: "project-id" }, update, @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.initializeCollabratecProject "project-id", "name", "user-id", "collabratec-document-id", "collabratec-private-group-id", @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")
