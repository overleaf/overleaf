sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Collaborators/CollaboratorsInviteController.js"
SandboxedModule = require('sandboxed-module')
events = require "events"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"
ObjectId = require("mongojs").ObjectId

describe "CollaboratorsInviteController", ->
	beforeEach ->
		@CollaboratorsInviteController = SandboxedModule.require modulePath, requires:
			"../Project/ProjectGetter": @ProjectGetter = {}
			'../Subscription/LimitationsManager' : @LimitationsManager = {}
			'../User/UserGetter': @UserGetter = {getUser: sinon.stub()}
			"./CollaboratorsHandler": @CollaboratorsHandler = {}
			"./CollaboratorsInviteHandler": @CollaboratorsInviteHandler = {}
			'logger-sharelatex': @logger = {err: sinon.stub(), error: sinon.stub(), log: sinon.stub()}
			"../Editor/EditorRealTimeController": @EditorRealTimeController = {emitToRoom: sinon.stub()}
			"../Notifications/NotificationsBuilder": @NotificationsBuilder = {}
		@res = new MockResponse()
		@req = new MockRequest()

		@project_id = "project-id-123"
		@callback = sinon.stub()

	describe '_tryCancelInviteNotification', ->
		beforeEach ->
			@inviteId = ObjectId()
			@currentUser = {_id: ObjectId()}
			@notification = {read: sinon.stub().callsArgWith(0, null)}
			@NotificationsBuilder.projectInvite = sinon.stub().returns(@notification)
			@call = (callback) =>
				@CollaboratorsInviteController._tryCancelInviteNotification @inviteId, @currentUser, callback

		it 'should not produce an error', (done) ->
			@call (err) =>
				expect(err).to.be.oneOf [null, undefined]
				done()

		it 'should call notification.read', (done) ->
			@call (err) =>
				@notification.read.callCount.should.equal 1
				done()

		describe 'when notification.read produces an error', ->
			beforeEach ->
				@notification = {read: sinon.stub().callsArgWith(0, new Error('woops'))}
				@NotificationsBuilder.projectInvite = sinon.stub().returns(@notification)

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

	describe "_trySendInviteNotification", ->

		beforeEach ->
			@invite =
				_id: ObjectId(),
				token: "some_token",
				sendingUserId: ObjectId(),
				projectId: @project_id,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			@sendingUser =
				_id: ObjectId()
				first_name: "jim"
			@existingUser = {_id: ObjectId()}
			@UserGetter.getUser = sinon.stub().callsArgWith(2, null, @existingUser)
			@fakeProject =
				_id: @project_id
				name: "some project"
			@ProjectGetter.getProject = sinon.stub().callsArgWith(1, null, @fakeProject)
			@notification = {create: sinon.stub().callsArgWith(0, null)}
			@NotificationsBuilder.projectInvite = sinon.stub().returns(@notification)
			@call = (callback) =>
				@CollaboratorsInviteController._trySendInviteNotification @project_id, @sendingUser, @invite, callback

		describe 'when the user exists', ->

			beforeEach ->

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.oneOf [null, undefined]
					done()

			it 'should call getUser', (done) ->
				@call (err) =>
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith({email: @invite.email}).should.equal true
					done()

			it 'should call getProject', (done) ->
				@call (err) =>
					@ProjectGetter.getProject.callCount.should.equal 1
					@ProjectGetter.getProject.calledWith(@project_id).should.equal true
					done()

			it 'should call NotificationsBuilder.projectInvite.create', (done) ->
				@call (err) =>
					@NotificationsBuilder.projectInvite.callCount.should.equal 1
					@notification.create.callCount.should.equal 1
					done()

			describe 'when getProject produces an error', ->

				beforeEach ->
					@ProjectGetter.getProject.callsArgWith(1, new Error('woops'))

				it 'should produce an error', (done) ->
					@call (err) =>
						expect(err).to.be.instanceof Error
						done()

				it 'should not call NotificationsBuilder.projectInvite.create', (done) ->
					@call (err) =>
						@NotificationsBuilder.projectInvite.callCount.should.equal 0
						@notification.create.callCount.should.equal 0
						done()

			describe 'when projectInvite.create produces an error', ->

				beforeEach ->
					@notification.create.callsArgWith(0, new Error('woops'))

				it 'should produce an error', (done) ->
					@call (err) =>
						expect(err).to.be.instanceof Error
						done()

		describe 'when the user does not exist', ->

			beforeEach ->
				@UserGetter.getUser = sinon.stub().callsArgWith(2, null, null)

			it 'should not produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.oneOf [null, undefined]
					done()

			it 'should call getUser', (done) ->
				@call (err) =>
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith({email: @invite.email}).should.equal true
					done()

			it 'should not call getProject', (done) ->
				@call (err) =>
					@ProjectGetter.getProject.callCount.should.equal 0
					done()

			it 'should not call NotificationsBuilder.projectInvite.create', (done) ->
				@call (err) =>
					@NotificationsBuilder.projectInvite.callCount.should.equal 0
					@notification.create.callCount.should.equal 0
					done()

		describe 'when the getUser produces an error', ->

			beforeEach ->
				@UserGetter.getUser = sinon.stub().callsArgWith(2, new Error('woops'))

			it 'should produce an error', (done) ->
				@call (err) =>
					expect(err).to.be.instanceof Error
					done()

			it 'should call getUser', (done) ->
				@call (err) =>
					@UserGetter.getUser.callCount.should.equal 1
					@UserGetter.getUser.calledWith({email: @invite.email}).should.equal true
					done()

			it 'should not call getProject', (done) ->
				@call (err) =>
					@ProjectGetter.getProject.callCount.should.equal 0
					done()

			it 'should not call NotificationsBuilder.projectInvite.create', (done) ->
				@call (err) =>
					@NotificationsBuilder.projectInvite.callCount.should.equal 0
					@notification.create.callCount.should.equal 0
					done()

	describe 'getAllInvites', ->

		beforeEach ->
			@fakeInvites = [
				{_id: ObjectId(), one: 1},
				{_id: ObjectId(), two: 2}
			]
			@req.params =
				Project_id: @project_id
			@res.json = sinon.stub()
			@next = sinon.stub()

		describe 'when all goes well', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getAllInvites = sinon.stub().callsArgWith(1, null, @fakeInvites)
				@CollaboratorsInviteController.getAllInvites @req, @res, @next

			it 'should not produce an error', ->
				@next.callCount.should.equal 0

			it 'should produce a list of invite objects', ->
				@res.json.callCount.should.equal 1
				@res.json.calledWith({invites: @fakeInvites}).should.equal true

			it 'should have called CollaboratorsInviteHandler.getAllInvites', ->
				@CollaboratorsInviteHandler.getAllInvites.callCount.should.equal 1
				@CollaboratorsInviteHandler.getAllInvites.calledWith(@project_id).should.equal true

		describe 'when CollaboratorsInviteHandler.getAllInvites produces an error', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getAllInvites = sinon.stub().callsArgWith(1, new Error('woops'))
				@CollaboratorsInviteController.getAllInvites @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				@next.firstCall.args[0].should.be.instanceof Error

	describe 'inviteToProject', ->

		beforeEach ->
			@targetEmail = "user@example.com"
			@req.params =
				Project_id: @project_id
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@req.body =
				email: @targetEmail
				privileges: @privileges = "readAndWrite"
			@res.json = sinon.stub()
			@res.sendStatus = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: "htnseuthaouse",
				sendingUserId: @current_user_id,
				projectId: @targetEmail,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			}
			@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
			@CollaboratorsInviteHandler.inviteToProject = sinon.stub().callsArgWith(4, null, @invite)
			@CollaboratorsInviteController._trySendInviteNotification = sinon.stub()
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when all goes well', ->

			beforeEach ->
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, true)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should produce json response', ->
				@res.json.callCount.should.equal 1
				({invite: @invite}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user_id,@targetEmail,@privileges).should.equal true

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

			it 'should call _trySendInviteNotification', ->
				@CollaboratorsInviteController._trySendInviteNotification.callCount.should.equal 1

		describe 'when the user is not allowed to add more collaborators', ->

			beforeEach ->
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, null, false)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should produce json response without an invite', ->
				@res.json.callCount.should.equal 1
				({invite: null}).should.deep.equal(@res.json.firstCall.args[0])

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when canAddXCollaborators produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@LimitationsManager.canAddXCollaborators = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should not have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 0

		describe 'when inviteToProject produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.inviteToProject = sinon.stub().callsArgWith(4, @err)
				@CollaboratorsInviteController.inviteToProject @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called canAddXCollaborators', ->
				@LimitationsManager.canAddXCollaborators.callCount.should.equal 1
				@LimitationsManager.canAddXCollaborators.calledWith(@project_id).should.equal true

			it 'should have called inviteToProject', ->
				@CollaboratorsInviteHandler.inviteToProject.callCount.should.equal 1
				@CollaboratorsInviteHandler.inviteToProject.calledWith(@project_id,@current_user_id,@targetEmail,@privileges).should.equal true

	describe "viewInvite", ->

		beforeEach ->
			@token = "some-opaque-token"
			@req.params =
				Project_id: @project_id
				token: @token
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.redirect = sinon.stub()
			@res.sendStatus = sinon.stub()
			@invite = {
				_id: ObjectId(),
				token: @token,
				sendingUserId: ObjectId(),
				projectId: @project_id,
				targetEmail: 'user@example.com'
				createdAt: new Date(),
			}
			@fakeProject =
				_id: @project_id
				name: "some project"
				owner_ref: @invite.sendingUserId
				collaberator_refs: []
				readOnly_refs: []
			@owner =
				_id: @fakeProject.owner_ref
				first_name: "John"
				last_name: "Doe"
				email: "john@example.com"

			@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, null, false, null)
			@CollaboratorsInviteHandler.getInviteByToken = sinon.stub().callsArgWith(2, null, @invite)
			@ProjectGetter.getProject = sinon.stub().callsArgWith(2, null, @fakeProject)
			@UserGetter.getUser.callsArgWith(2, null, @owner)

			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when the token is valid', ->

			beforeEach ->
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/show').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsInviteHandler.getInviteByToken.calledWith(@fakeProject._id, @invite.token).should.equal true

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1
				@ProjectGetter.getProject.calledWith(@project_id).should.equal true

		describe 'when user is already a member of the project', ->

			beforeEach ->
				@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, null, true, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should redirect to the project page', ->
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith("/project/#{@project_id}").should.equal true

			it 'should not call next with an error', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 0

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when isUserMemberOfProject produces an error', ->

			beforeEach ->
				@CollaboratorsHandler.isUserMemberOfProject = sinon.stub().callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should call next with an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 0

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when the getInviteByToken produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, @err)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when the getInviteByToken does not produce an invite', ->

			beforeEach ->
				@CollaboratorsInviteHandler.getInviteByToken.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should not call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 0

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when User.getUser produces an error', ->

			beforeEach ->
				@UserGetter.getUser.callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when User.getUser does not find a user', ->

			beforeEach ->
				@UserGetter.getUser.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should not call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 0

		describe 'when getProject produces an error', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, new Error('woops'))
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should produce an error', ->
				@next.callCount.should.equal 1
				expect(@next.firstCall.args[0]).to.be.instanceof Error

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call User.getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1

		describe 'when Project.getUser does not find a user', ->

			beforeEach ->
				@ProjectGetter.getProject.callsArgWith(2, null, null)
				@CollaboratorsInviteController.viewInvite @req, @res, @next

			it 'should render the not-valid view template', ->
				@res.render.callCount.should.equal 1
				@res.render.calledWith('project/invite/not-valid').should.equal true

			it 'should not call next', ->
				@next.callCount.should.equal 0

			it 'should call CollaboratorsHandler.isUserMemberOfProject', ->
				@CollaboratorsHandler.isUserMemberOfProject.callCount.should.equal 1
				@CollaboratorsHandler.isUserMemberOfProject.calledWith(@current_user_id, @project_id).should.equal true

			it 'should call getInviteByToken', ->
				@CollaboratorsInviteHandler.getInviteByToken.callCount.should.equal 1

			it 'should call getUser', ->
				@UserGetter.getUser.callCount.should.equal 1
				@UserGetter.getUser.calledWith({_id: @fakeProject.owner_ref}).should.equal true

			it 'should call ProjectGetter.getProject', ->
				@ProjectGetter.getProject.callCount.should.equal 1

	describe "resendInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.sendStatus = sinon.stub()
			@CollaboratorsInviteHandler.resendInvite = sinon.stub().callsArgWith(2, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when resendInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.resendInvite @req, @res, @next

			it 'should produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 1
				@res.sendStatus.calledWith(201).should.equal true

			it 'should have called resendInvite', ->
				@CollaboratorsInviteHandler.resendInvite.callCount.should.equal 1

		describe 'when resendInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.resendInvite = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.resendInvite @req, @res, @next

			it 'should not produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called resendInvite', ->
				@CollaboratorsInviteHandler.resendInvite.callCount.should.equal 1


	describe "revokeInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@res.render = sinon.stub()
			@res.sendStatus = sinon.stub()
			@CollaboratorsInviteHandler.revokeInvite = sinon.stub().callsArgWith(2, null)
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when revokeInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.revokeInvite @req, @res, @next

			it 'should produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 1
				@res.sendStatus.calledWith(201).should.equal true

			it 'should have called revokeInvite', ->
				@CollaboratorsInviteHandler.revokeInvite.callCount.should.equal 1

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

		describe 'when revokeInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.revokeInvite = sinon.stub().callsArgWith(2, @err)
				@CollaboratorsInviteController.revokeInvite @req, @res, @next

			it 'should not produce a 201 response', ->
				@res.sendStatus.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called revokeInvite', ->
				@CollaboratorsInviteHandler.revokeInvite.callCount.should.equal 1

	describe "acceptInvite", ->

		beforeEach ->
			@req.params =
				Project_id: @project_id
				invite_id: @invite_id = "thuseoautoh"
			@req.session =
				user: _id: @current_user_id = "current-user-id"
			@req.body =
				token: "thsueothaueotauahsuet"
			@res.render = sinon.stub()
			@res.redirect = sinon.stub()
			@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(4, null)
			@CollaboratorsInviteController._tryCancelInviteNotification = sinon.stub()
			@callback = sinon.stub()
			@next = sinon.stub()

		describe 'when acceptInvite does not produce an error', ->

			beforeEach ->
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should redirect to project page', () ->
				@res.redirect.callCount.should.equal 1
				@res.redirect.calledWith("/project/#{@project_id}").should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite.callCount.should.equal 1

			it 'should have called emitToRoom', ->
				@EditorRealTimeController.emitToRoom.callCount.should.equal 1
				@EditorRealTimeController.emitToRoom.calledWith(@project_id, 'project:membership:changed').should.equal true

			it 'should call _tryCancelInviteNotification', ->
				@CollaboratorsInviteController._tryCancelInviteNotification.callCount.should.equal 1

		describe 'when revokeInvite produces an error', ->

			beforeEach ->
				@err = new Error('woops')
				@CollaboratorsInviteHandler.acceptInvite = sinon.stub().callsArgWith(4, @err)
				@CollaboratorsInviteController.acceptInvite @req, @res, @next

			it 'should not redirect to project page', ->
				@res.redirect.callCount.should.equal 0

			it 'should call next with the error', ->
				@next.callCount.should.equal 1
				@next.calledWith(@err).should.equal true

			it 'should have called acceptInvite', ->
				@CollaboratorsInviteHandler.acceptInvite.callCount.should.equal 1
