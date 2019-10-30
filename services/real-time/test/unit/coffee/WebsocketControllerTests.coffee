chai = require('chai')
should = chai.should()
sinon = require("sinon")
expect = chai.expect
modulePath = "../../../app/js/WebsocketController.js"
SandboxedModule = require('sandboxed-module')
tk = require "timekeeper"

describe 'WebsocketController', ->
	beforeEach ->
		tk.freeze(new Date())
		@project_id = "project-id-123"
		@user = {
			_id: @user_id = "user-id-123"
			first_name: "James"
			last_name: "Allen"
			email: "james@example.com"
			signUpDate: new Date("2014-01-01")
			loginCount: 42
		}
		@callback = sinon.stub()
		@client =
			id: @client_id = "mock-client-id-123"
			params: {}
			set: sinon.stub()
			get: (param, cb) -> cb null, @params[param]
			join: sinon.stub()
			leave: sinon.stub()
		@WebsocketController = SandboxedModule.require modulePath, requires:
			"./WebApiManager": @WebApiManager = {}
			"./AuthorizationManager": @AuthorizationManager = {}
			"./DocumentUpdaterManager": @DocumentUpdaterManager = {}
			"./ConnectedUsersManager": @ConnectedUsersManager = {}
			"./WebsocketLoadBalancer": @WebsocketLoadBalancer = {}
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub(), warn: sinon.stub() }
			"metrics-sharelatex": @metrics =
				inc: sinon.stub()
				set: sinon.stub()
			"./RoomManager": @RoomManager = {}

	afterEach ->
		tk.reset()

	describe "joinProject", ->
		describe "when authorised", ->
			beforeEach ->
				@client.id = "mock-client-id"
				@project = {
					name: "Test Project"
					owner: {
						_id: @owner_id = "mock-owner-id-123"
					}
				}
				@privilegeLevel = "owner"
				@ConnectedUsersManager.updateUserPosition = sinon.stub().callsArg(4)
				@isRestrictedUser = true
				@WebApiManager.joinProject = sinon.stub().callsArgWith(2, null, @project, @privilegeLevel, @isRestrictedUser)
				@RoomManager.joinProject = sinon.stub().callsArg(2)
				@WebsocketController.joinProject @client, @user, @project_id, @callback

			it "should load the project from web", ->
				@WebApiManager.joinProject
					.calledWith(@project_id, @user)
					.should.equal true

			it "should join the project room", ->
				@RoomManager.joinProject.calledWith(@client, @project_id).should.equal true

			it "should set the privilege level on the client", ->
				@client.set.calledWith("privilege_level", @privilegeLevel).should.equal true

			it "should set the user's id on the client", ->
				@client.set.calledWith("user_id", @user._id).should.equal true

			it "should set the user's email on the client", ->
				@client.set.calledWith("email", @user.email).should.equal true

			it "should set the user's first_name on the client", ->
				@client.set.calledWith("first_name", @user.first_name).should.equal true

			it "should set the user's last_name on the client", ->
				@client.set.calledWith("last_name", @user.last_name).should.equal true

			it "should set the user's sign up date on the client", ->
				@client.set.calledWith("signup_date", @user.signUpDate).should.equal true

			it "should set the user's login_count on the client", ->
				@client.set.calledWith("login_count", @user.loginCount).should.equal true

			it "should set the connected time on the client", ->
				@client.set.calledWith("connected_time", new Date()).should.equal true

			it "should set the project_id on the client", ->
				@client.set.calledWith("project_id", @project_id).should.equal true

			it "should set the project owner id on the client", ->
				@client.set.calledWith("owner_id", @owner_id).should.equal true

			it "should set the is_restricted_user flag on the client", ->
				@client.set.calledWith("is_restricted_user", @isRestrictedUser).should.equal true

			it "should call the callback with the project, privilegeLevel and protocolVersion", ->
				@callback
					.calledWith(null, @project, @privilegeLevel, @WebsocketController.PROTOCOL_VERSION)
					.should.equal true

			it "should mark the user as connected in ConnectedUsersManager", ->
				@ConnectedUsersManager.updateUserPosition
					.calledWith(@project_id, @client.id, @user, null)
					.should.equal true

			it "should increment the join-project metric", ->
				@metrics.inc.calledWith("editor.join-project").should.equal true

		describe "when not authorized", ->
			beforeEach ->
				@WebApiManager.joinProject = sinon.stub().callsArgWith(2, null, null, null)
				@WebsocketController.joinProject @client, @user, @project_id, @callback

			it "should return an error", ->
				@callback
					.calledWith(new Error("not authorized"))
					.should.equal true

			it "should not log an error", ->
				@logger.error.called.should.equal false

	describe "leaveProject", ->
		beforeEach ->
			@DocumentUpdaterManager.flushProjectToMongoAndDelete = sinon.stub().callsArg(1)
			@ConnectedUsersManager.markUserAsDisconnected = sinon.stub().callsArg(2)
			@WebsocketLoadBalancer.emitToRoom = sinon.stub()
			@RoomManager.leaveProjectAndDocs = sinon.stub()
			@clientsInRoom = []
			@io =
				sockets:
					clients: (room_id) =>
						if room_id != @project_id
							throw "expected room_id to be project_id"
						return @clientsInRoom
			@client.params.project_id = @project_id
			@client.params.user_id = @user_id
			@WebsocketController.FLUSH_IF_EMPTY_DELAY = 0
			tk.reset() # Allow setTimeout to work.

		describe "when the project is empty", ->
			beforeEach (done) ->
				@clientsInRoom = []
				@WebsocketController.leaveProject @io, @client, done

			it "should end clientTracking.clientDisconnected to the project room", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.clientDisconnected", @client.id)
					.should.equal true

			it "should mark the user as disconnected", ->
				@ConnectedUsersManager.markUserAsDisconnected
					.calledWith(@project_id, @client.id)
					.should.equal true

			it "should flush the project in the document updater", ->
				@DocumentUpdaterManager.flushProjectToMongoAndDelete
					.calledWith(@project_id)
					.should.equal true

			it "should increment the leave-project metric", ->
				@metrics.inc.calledWith("editor.leave-project").should.equal true

			it "should track the disconnection in RoomManager", ->
				@RoomManager.leaveProjectAndDocs
					.calledWith(@client)
					.should.equal true

		describe "when the project is not empty", ->
			beforeEach ->
				@clientsInRoom = ["mock-remaining-client"]
				@WebsocketController.leaveProject @io, @client

			it "should not flush the project in the document updater", ->
				@DocumentUpdaterManager.flushProjectToMongoAndDelete
					.called.should.equal false

		describe "when client has not authenticated", ->
			beforeEach (done) ->
				@client.params.user_id = null
				@client.params.project_id = null
				@WebsocketController.leaveProject @io, @client, done

			it "should not end clientTracking.clientDisconnected to the project room", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.clientDisconnected", @client.id)
					.should.equal false

			it "should not mark the user as disconnected", ->
				@ConnectedUsersManager.markUserAsDisconnected
					.calledWith(@project_id, @client.id)
					.should.equal false

			it "should not flush the project in the document updater", ->
				@DocumentUpdaterManager.flushProjectToMongoAndDelete
					.calledWith(@project_id)
					.should.equal false

			it "should increment the leave-project metric", ->
				@metrics.inc.calledWith("editor.leave-project").should.equal true

		describe "when client has not joined a project", ->
			beforeEach (done) ->
				@client.params.user_id = @user_id
				@client.params.project_id = null
				@WebsocketController.leaveProject @io, @client, done

			it "should not end clientTracking.clientDisconnected to the project room", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.clientDisconnected", @client.id)
					.should.equal false

			it "should not mark the user as disconnected", ->
				@ConnectedUsersManager.markUserAsDisconnected
					.calledWith(@project_id, @client.id)
					.should.equal false

			it "should not flush the project in the document updater", ->
				@DocumentUpdaterManager.flushProjectToMongoAndDelete
					.calledWith(@project_id)
					.should.equal false

			it "should increment the leave-project metric", ->
				@metrics.inc.calledWith("editor.leave-project").should.equal true

	describe "joinDoc", ->
		beforeEach ->
			@doc_id = "doc-id-123"
			@doc_lines = ["doc", "lines"]
			@version = 42
			@ops = ["mock", "ops"]
			@ranges = { "mock": "ranges" }
			@options = {}

			@client.params.project_id = @project_id
			@AuthorizationManager.addAccessToDoc = sinon.stub()
			@AuthorizationManager.assertClientCanViewProject = sinon.stub().callsArgWith(1, null)
			@DocumentUpdaterManager.getDocument = sinon.stub().callsArgWith(3, null, @doc_lines, @version, @ranges, @ops)
			@RoomManager.joinDoc = sinon.stub().callsArg(2)

		describe "works", ->
			beforeEach ->
				@WebsocketController.joinDoc @client, @doc_id, -1, @options, @callback

			it "should check that the client is authorized to view the project", ->
				@AuthorizationManager.assertClientCanViewProject
					.calledWith(@client)
					.should.equal true

			it "should get the document from the DocumentUpdaterManager with fromVersion", ->
				@DocumentUpdaterManager.getDocument
					.calledWith(@project_id, @doc_id, -1)
					.should.equal true

			it "should add permissions for the client to access the doc", ->
				@AuthorizationManager.addAccessToDoc
					.calledWith(@client, @doc_id)
					.should.equal true

			it "should join the client to room for the doc_id", ->
				@RoomManager.joinDoc
					.calledWith(@client, @doc_id)
					.should.equal true

			it "should call the callback with the lines, version, ranges and ops", ->
				@callback
					.calledWith(null, @doc_lines, @version, @ops, @ranges)
					.should.equal true

			it "should increment the join-doc metric", ->
				@metrics.inc.calledWith("editor.join-doc").should.equal true

		describe "with a fromVersion", ->
			beforeEach ->
				@fromVersion = 40
				@WebsocketController.joinDoc @client, @doc_id, @fromVersion, @options, @callback

			it "should get the document from the DocumentUpdaterManager with fromVersion", ->
				@DocumentUpdaterManager.getDocument
					.calledWith(@project_id, @doc_id, @fromVersion)
					.should.equal true

		describe "with doclines that need escaping", ->
			beforeEach ->
				@doc_lines.push ["räksmörgås"]
				@WebsocketController.joinDoc @client, @doc_id, -1, @options, @callback

			it "should call the callback with the escaped lines", ->
				escaped_lines = @callback.args[0][1]
				escaped_word = escaped_lines.pop()
				escaped_word.should.equal 'rÃ¤ksmÃ¶rgÃ¥s'
				# Check that unescaping works
				decodeURIComponent(escape(escaped_word)).should.equal "räksmörgås"

		describe "with comments that need encoding", ->
			beforeEach ->
				@ranges.comments = [{ op: { c: "räksmörgås" } }]
				@WebsocketController.joinDoc @client, @doc_id, -1, { encodeRanges: true }, @callback

			it "should call the callback with the encoded comment", ->
				encoded_comments = @callback.args[0][4]
				encoded_comment = encoded_comments.comments.pop()
				encoded_comment_text = encoded_comment.op.c
				encoded_comment_text.should.equal 'rÃ¤ksmÃ¶rgÃ¥s'

		describe "with changes that need encoding", ->
			it "should call the callback with the encoded insert change", ->
				@ranges.changes = [{ op: { i: "räksmörgås" } }]
				@WebsocketController.joinDoc @client, @doc_id, -1, { encodeRanges: true }, @callback

				encoded_changes = @callback.args[0][4]
				encoded_change = encoded_changes.changes.pop()
				encoded_change_text = encoded_change.op.i
				encoded_change_text.should.equal 'rÃ¤ksmÃ¶rgÃ¥s'

			it "should call the callback with the encoded delete change", ->
				@ranges.changes = [{ op: { d: "räksmörgås" } }]
				@WebsocketController.joinDoc @client, @doc_id, -1, { encodeRanges: true }, @callback

				encoded_changes = @callback.args[0][4]
				encoded_change = encoded_changes.changes.pop()
				encoded_change_text = encoded_change.op.d
				encoded_change_text.should.equal 'rÃ¤ksmÃ¶rgÃ¥s'

		describe "when not authorized", ->
			beforeEach ->
				@AuthorizationManager.assertClientCanViewProject = sinon.stub().callsArgWith(1, @err = new Error("not authorized"))
				@WebsocketController.joinDoc @client, @doc_id, -1, @options, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(@err).should.equal true

			it "should not call the DocumentUpdaterManager", ->
				@DocumentUpdaterManager.getDocument.called.should.equal false

	describe "leaveDoc", ->
		beforeEach ->
			@doc_id = "doc-id-123"
			@client.params.project_id = @project_id
			@RoomManager.leaveDoc = sinon.stub()
			@WebsocketController.leaveDoc @client, @doc_id, @callback

		it "should remove the client from the doc_id room", ->
			@RoomManager.leaveDoc
				.calledWith(@client, @doc_id).should.equal true

		it "should call the callback", ->
			@callback.called.should.equal true

		it "should increment the leave-doc metric", ->
			@metrics.inc.calledWith("editor.leave-doc").should.equal true

	describe "getConnectedUsers", ->
		beforeEach ->
			@client.params.project_id = @project_id
			@users = ["mock", "users"]
			@WebsocketLoadBalancer.emitToRoom = sinon.stub()
			@ConnectedUsersManager.getConnectedUsers = sinon.stub().callsArgWith(1, null, @users)

		describe "when authorized", ->
			beforeEach (done) ->
				@AuthorizationManager.assertClientCanViewProject = sinon.stub().callsArgWith(1, null)
				@WebsocketController.getConnectedUsers @client, (args...) =>
					@callback(args...)
					done()

			it "should check that the client is authorized to view the project", ->
				@AuthorizationManager.assertClientCanViewProject
					.calledWith(@client)
					.should.equal true

			it "should broadcast a request to update the client list", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.refresh")
					.should.equal true

			it "should get the connected users for the project", ->
				@ConnectedUsersManager.getConnectedUsers
					.calledWith(@project_id)
					.should.equal true

			it "should return the users", ->
				@callback.calledWith(null, @users).should.equal true

			it "should increment the get-connected-users metric", ->
				@metrics.inc.calledWith("editor.get-connected-users").should.equal true

		describe "when not authorized", ->
			beforeEach ->
				@AuthorizationManager.assertClientCanViewProject = sinon.stub().callsArgWith(1, @err = new Error("not authorized"))
				@WebsocketController.getConnectedUsers @client, @callback

			it "should not get the connected users for the project", ->
				@ConnectedUsersManager.getConnectedUsers
					.called
					.should.equal false

			it "should return an error", ->
				@callback.calledWith(@err).should.equal true

		describe "when restricted user", ->
			beforeEach ->
				@client.params.is_restricted_user = true
				@AuthorizationManager.assertClientCanViewProject = sinon.stub().callsArgWith(1, null)
				@WebsocketController.getConnectedUsers @client, @callback

			it "should return an empty array of users", ->
				@callback.calledWith(null, []).should.equal true

			it "should not get the connected users for the project", ->
				@ConnectedUsersManager.getConnectedUsers
					.called
					.should.equal false

	describe "updateClientPosition", ->
		beforeEach ->
			@WebsocketLoadBalancer.emitToRoom = sinon.stub()
			@ConnectedUsersManager.updateUserPosition = sinon.stub().callsArgWith(4)
			@AuthorizationManager.assertClientCanViewProjectAndDoc = sinon.stub().callsArgWith(2, null)
			@update = {
				doc_id: @doc_id = "doc-id-123"
				row: @row = 42
				column: @column = 37
			}

		describe "with a logged in user", ->
			beforeEach ->
				@clientParams = {
					project_id: @project_id
					first_name: @first_name = "Douglas"
					last_name: @last_name = "Adams"
					email: @email = "joe@example.com"
					user_id: @user_id = "user-id-123"
				}
				@client.get = (param, callback) => callback null, @clientParams[param]
				@WebsocketController.updateClientPosition @client, @update

				@populatedCursorData =
					doc_id: @doc_id,
					id: @client.id
					name: "#{@first_name} #{@last_name}"
					row: @row
					column: @column
					email: @email
					user_id: @user_id

			it "should send the update to the project room with the user's name", ->
				@WebsocketLoadBalancer.emitToRoom.calledWith(@project_id, "clientTracking.clientUpdated", @populatedCursorData).should.equal true

			it "should send the  cursor data to the connected user manager", (done)->
				@ConnectedUsersManager.updateUserPosition.calledWith(@project_id, @client.id, {
					_id: @user_id,
					email: @email,
					first_name: @first_name,
					last_name: @last_name
				}, {
					row: @row
					column: @column
					doc_id: @doc_id
				}).should.equal true
				done()

			it "should increment the update-client-position metric at 0.1 frequency", ->
				@metrics.inc.calledWith("editor.update-client-position", 0.1).should.equal true

		describe "with a logged in user who has no last_name set", ->
			beforeEach ->
				@clientParams = {
					project_id: @project_id
					first_name: @first_name = "Douglas"
					last_name: undefined
					email: @email = "joe@example.com"
					user_id: @user_id = "user-id-123"
				}
				@client.get = (param, callback) => callback null, @clientParams[param]
				@WebsocketController.updateClientPosition @client, @update

				@populatedCursorData =
					doc_id: @doc_id,
					id: @client.id
					name: "#{@first_name}"
					row: @row
					column: @column
					email: @email
					user_id: @user_id

			it "should send the update to the project room with the user's name", ->
				@WebsocketLoadBalancer.emitToRoom.calledWith(@project_id, "clientTracking.clientUpdated", @populatedCursorData).should.equal true

			it "should send the  cursor data to the connected user manager", (done)->
				@ConnectedUsersManager.updateUserPosition.calledWith(@project_id, @client.id, {
					_id: @user_id,
					email: @email,
					first_name: @first_name,
					last_name: undefined
				}, {
					row: @row
					column: @column
					doc_id: @doc_id
				}).should.equal true
				done()

			it "should increment the update-client-position metric at 0.1 frequency", ->
				@metrics.inc.calledWith("editor.update-client-position", 0.1).should.equal true

		describe "with a logged in user who has no first_name set", ->
			beforeEach ->
				@clientParams = {
					project_id: @project_id
					first_name: undefined
					last_name: @last_name = "Adams"
					email: @email = "joe@example.com"
					user_id: @user_id = "user-id-123"
				}
				@client.get = (param, callback) => callback null, @clientParams[param]
				@WebsocketController.updateClientPosition @client, @update

				@populatedCursorData =
					doc_id: @doc_id,
					id: @client.id
					name: "#{@last_name}"
					row: @row
					column: @column
					email: @email
					user_id: @user_id

			it "should send the update to the project room with the user's name", ->
				@WebsocketLoadBalancer.emitToRoom.calledWith(@project_id, "clientTracking.clientUpdated", @populatedCursorData).should.equal true

			it "should send the  cursor data to the connected user manager", (done)->
				@ConnectedUsersManager.updateUserPosition.calledWith(@project_id, @client.id, {
					_id: @user_id,
					email: @email,
					first_name: undefined,
					last_name: @last_name
				}, {
					row: @row
					column: @column
					doc_id: @doc_id
				}).should.equal true
				done()

			it "should increment the update-client-position metric at 0.1 frequency", ->
				@metrics.inc.calledWith("editor.update-client-position", 0.1).should.equal true
		describe "with a logged in user who has no names set", ->
			beforeEach ->
				@clientParams = {
					project_id: @project_id
					first_name: undefined
					last_name: undefined
					email: @email = "joe@example.com"
					user_id: @user_id = "user-id-123"
				}
				@client.get = (param, callback) => callback null, @clientParams[param]
				@WebsocketController.updateClientPosition @client, @update

			it "should send the update to the project name with no name", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.clientUpdated", {
						doc_id: @doc_id,
						id: @client.id,
						user_id: @user_id,
						name: "",
						row: @row,
						column: @column,
						email: @email
					})
					.should.equal true


		describe "with an anonymous user", ->
			beforeEach ->
				@clientParams = {
					project_id: @project_id
				}
				@client.get = (param, callback) => callback null, @clientParams[param]
				@WebsocketController.updateClientPosition @client, @update

			it "should send the update to the project room with no name", ->
				@WebsocketLoadBalancer.emitToRoom
					.calledWith(@project_id, "clientTracking.clientUpdated", {
						doc_id: @doc_id,
						id: @client.id
						name: ""
						row: @row
						column: @column
					})
					.should.equal true

			it "should not send cursor data to the connected user manager", (done)->
				@ConnectedUsersManager.updateUserPosition.called.should.equal false
				done()

	describe "applyOtUpdate", ->
		beforeEach ->
			@update = {op: {p: 12, t: "foo"}}
			@client.params.user_id = @user_id
			@client.params.project_id = @project_id
			@WebsocketController._assertClientCanApplyUpdate = sinon.stub().yields()
			@DocumentUpdaterManager.queueChange = sinon.stub().callsArg(3)

		describe "succesfully", ->
			beforeEach ->
				@WebsocketController.applyOtUpdate @client, @doc_id, @update, @callback

			it "should set the source of the update to the client id", ->
				@update.meta.source.should.equal @client.id

			it "should set the user_id of the update to the user id", ->
				@update.meta.user_id.should.equal @user_id

			it "should queue the update", ->
				@DocumentUpdaterManager.queueChange
					.calledWith(@project_id, @doc_id, @update)
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

			it "should increment the doc updates", ->
				@metrics.inc.calledWith("editor.doc-update").should.equal true

		describe "unsuccessfully", ->
			beforeEach ->
				@client.disconnect = sinon.stub()
				@DocumentUpdaterManager.queueChange = sinon.stub().callsArgWith(3, @error = new Error("Something went wrong"))
				@WebsocketController.applyOtUpdate @client, @doc_id, @update, @callback

			it "should disconnect the client", ->
				@client.disconnect.called.should.equal true

			it "should log an error", ->
				@logger.error.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

		describe "when not authorized", ->
			beforeEach ->
				@client.disconnect = sinon.stub()
				@WebsocketController._assertClientCanApplyUpdate = sinon.stub().yields(@error = new Error("not authorized"))
				@WebsocketController.applyOtUpdate @client, @doc_id, @update, @callback

			# This happens in a setTimeout to allow the client a chance to receive the error first.
			# I'm not sure how to unit test, but it is acceptance tested.
			# it "should disconnect the client", ->
			# 	@client.disconnect.called.should.equal true

			it "should log a warning", ->
				@logger.warn.called.should.equal true

			it "should call the callback with the error", ->
				@callback.calledWith(@error).should.equal true

	describe "_assertClientCanApplyUpdate", ->
		beforeEach ->
			@edit_update = { op: [{i: "foo", p: 42}, {c: "bar", p: 132}] } # comments may still be in an edit op
			@comment_update = { op: [{c: "bar", p: 132}] }
			@AuthorizationManager.assertClientCanEditProjectAndDoc = sinon.stub()
			@AuthorizationManager.assertClientCanViewProjectAndDoc = sinon.stub()

		describe "with a read-write client", ->
			it "should return successfully", (done) ->
				@AuthorizationManager.assertClientCanEditProjectAndDoc.yields(null)
				@WebsocketController._assertClientCanApplyUpdate @client, @doc_id, @edit_update, (error) ->
					expect(error).to.be.null
					done()

		describe "with a read-only client and an edit op", ->
			it "should return an error", (done) ->
				@AuthorizationManager.assertClientCanEditProjectAndDoc.yields(new Error("not authorized"))
				@AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
				@WebsocketController._assertClientCanApplyUpdate @client, @doc_id, @edit_update, (error) ->
					expect(error.message).to.equal "not authorized"
					done()

		describe "with a read-only client and a comment op", ->
			it "should return successfully", (done) ->
				@AuthorizationManager.assertClientCanEditProjectAndDoc.yields(new Error("not authorized"))
				@AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
				@WebsocketController._assertClientCanApplyUpdate @client, @doc_id, @comment_update, (error) ->
					expect(error).to.be.null
					done()

		describe "with a totally unauthorized client", ->
			it "should return an error", (done) ->
				@AuthorizationManager.assertClientCanEditProjectAndDoc.yields(new Error("not authorized"))
				@AuthorizationManager.assertClientCanViewProjectAndDoc.yields(new Error("not authorized"))
				@WebsocketController._assertClientCanApplyUpdate @client, @doc_id, @comment_update, (error) ->
					expect(error.message).to.equal "not authorized"
					done()
