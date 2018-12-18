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
		@projectId = ObjectId("5bea8747c7bba6012fcaceb3")
		@userId = ObjectId("5be316a9c7f6aa03802ea8fb")
		@userId2 = ObjectId("5c1794b3f0e89b1d1c577eca")
		@ProjectModel = {}
		@ProjectCollabratecDetailsHandler = SandboxedModule.require modulePath, requires:
			"../../models/Project": { Project: @ProjectModel }
		@callback = sinon.stub()

	describe "initializeCollabratecProject", ->

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.initializeCollabratecProject @projectId, @userId, "collabratec-document-id", "collabratec-private-group-id", @callback

			it "should update project model", ->
				update = $set: {
					collabratecUsers: [ {
						user_id: @userId,
						collabratec_document_id: "collabratec-document-id",
						collabratec_privategroup_id: "collabratec-private-group-id"
					} ]
				}
				expect(@ProjectModel.update).to.have.been.calledWith { _id: @projectId }, update, @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.initializeCollabratecProject @projectId, @userId, "collabratec-document-id", "collabratec-private-group-id", @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")

		describe "with invalid args", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.initializeCollabratecProject "bad-project-id", "bad-user-id", "collabratec-document-id", "collabratec-private-group-id", @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

	describe "isLinkedCollabratecUserProject", ->
		beforeEach ->
			@ProjectModel.findOne = sinon.stub().yields()

		describe "when find succeeds", ->
			describe "when user project found", ->
				beforeEach ->
					@ProjectModel.findOne = sinon.stub().yields(null, "project")
					@ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject @projectId, @userId, @callback

				it "should call find with project and user id", ->
					expect(@ProjectModel.findOne).to.have.been.calledWithMatch {
						_id: ObjectId(@projectId)
						collabratecUsers: $elemMatch:
							user_id: ObjectId(@userId)
					}

				it "should callback with true", ->
					expect(@callback).to.have.been.calledWith null, true

			describe "when user project found", ->
				beforeEach ->
					@ProjectModel.findOne = sinon.stub().yields(null, null)
					@ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject @projectId, @userId, @callback

				it "should callback with false", ->
					expect(@callback).to.have.been.calledWith null, false

		describe "when find has error", ->
			beforeEach ->
				@ProjectModel.findOne = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject @projectId, @userId, @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith "error"

		describe "with invalid args", ->
			beforeEach ->
				@ProjectModel.findOne = sinon.stub()
				@ProjectCollabratecDetailsHandler.isLinkedCollabratecUserProject "bad-project-id", "bad-user-id", @callback

			it "should not update", ->
				expect(@ProjectModel.findOne).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

	describe "linkCollabratecUserProject", ->

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.linkCollabratecUserProject @projectId, @userId, "collabratec-document-id", @callback

			it "should update project model", ->
				query =
					_id: @projectId
					collabratecUsers: $not: $elemMatch:
						collabratec_document_id: "collabratec-document-id"
						user_id: @userId
				update = $push: collabratecUsers:
					collabratec_document_id: "collabratec-document-id"
					user_id: @userId
				expect(@ProjectModel.update).to.have.been.calledWith query, update, @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.linkCollabratecUserProject @projectId, @userId, "collabratec-document-id", @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")

		describe "with invalid args", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.linkCollabratecUserProject "bad-project-id", "bad-user-id", "collabratec-document-id", @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

	describe "setCollabratecUsers", ->
		beforeEach ->
			@collabratecUsers = [
				{
					user_id: @userId
					collabratec_document_id: "collabratec-document-id-1"
					collabratec_privategroup_id: "collabratec-private-group-id-1"
				},
				{
					user_id: @userId2
					collabratec_document_id: "collabratec-document-id-2"
					collabratec_privategroup_id: "collabratec-private-group-id-2"
				}
			]

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.setCollabratecUsers @projectId, @collabratecUsers, @callback

			it "should update project model", ->
				update = $set: {
					collabratecUsers: @collabratecUsers
				}
				expect(@ProjectModel.update).to.have.been.calledWith { _id: @projectId }, update, @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.setCollabratecUsers @projectId, @collabratecUsers, @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")

		describe "with invalid project_id", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.setCollabratecUsers "bad-project-id", @collabratecUsers, @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

		describe "with invalid user_id", ->
			beforeEach ->
				@collabratecUsers[1].user_id = "bad-user-id"
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.setCollabratecUsers @projectId, @collabratecUsers, @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

	describe "unlinkCollabratecUserProject", ->

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject @projectId, @userId, @callback

			it "should update project model", ->
				query =
					_id: @projectId
				update = $pull: collabratecUsers:
					user_id: @userId
				expect(@ProjectModel.update).to.have.been.calledWith query, update, @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject @projectId, @userId, @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")

		describe "with invalid args", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.unlinkCollabratecUserProject "bad-project-id", "bad-user-id", @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

	describe "updateCollabratecUserIds", ->

		describe "when update succeeds", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields()
				@ProjectCollabratecDetailsHandler.updateCollabratecUserIds @userId, @userId2, @callback

			it "should update project model", ->
				expect(@ProjectModel.update).to.have.been.calledWith { "collabratecUsers.user_id": @userId }, { $set: "collabratecUsers.$.user_id": @userId2 }, { multi: true},  @callback

		describe "when update has error", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub().yields("error")
				@ProjectCollabratecDetailsHandler.updateCollabratecUserIds @userId, @userId2, @callback

			it "should callback with error", ->
				expect(@callback).to.have.been.calledWith("error")

		describe "with invalid old_user_id", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.updateCollabratecUserIds "bad-user-id", @userId2, @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error

		describe "with invalid new_user_id", ->
			beforeEach ->
				@ProjectModel.update = sinon.stub()
				@ProjectCollabratecDetailsHandler.updateCollabratecUserIds @userId, "bad-user-id", @callback

			it "should not update", ->
				expect(@ProjectModel.update).not.to.have.beenCalled

			it "should callback with error", ->
				expect(@callback.firstCall.args[0]).to.be.instanceOf Error