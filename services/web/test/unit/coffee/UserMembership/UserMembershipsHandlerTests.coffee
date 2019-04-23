sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
ObjectId = require("../../../../app/js/infrastructure/mongojs").ObjectId
modulePath = "../../../../app/js/Features/UserMembership/UserMembershipsHandler"
SandboxedModule = require("sandboxed-module")

describe 'UserMembershipsHandler', ->
	beforeEach ->
		@user = _id: ObjectId()

		@Institution =
			updateMany: sinon.stub().yields(null)
		@Subscription =
			updateMany: sinon.stub().yields(null)
		@Publisher =
			updateMany: sinon.stub().yields(null)
		@UserMembershipsHandler = SandboxedModule.require modulePath, requires:
			'../../models/Institution': Institution: @Institution
			'../../models/Subscription': Subscription: @Subscription
			'../../models/Publisher': Publisher: @Publisher

	describe 'remove user', ->
		it 'remove user from all entities', (done) ->
			@UserMembershipsHandler.removeUserFromAllEntities @user._id, (error) =>
				assertCalledWith(
					@Institution.updateMany,
					{},
					{ "$pull": { managerIds: @user._id } }
				)
				assertCalledWith(
					@Subscription.updateMany,
					{},
					{ "$pull": { manager_ids: @user._id } }
				)
				assertCalledWith(
					@Publisher.updateMany,
					{},
					{ "$pull": { managerIds: @user._id } }
				)
				done()
