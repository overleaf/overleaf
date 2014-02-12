define [
	"libs/chai"
	"project-members/ProjectMembersManager"
	"models/User"
	"models/Project"
	"account/AccountManager"
	"tests/unit/helpers"
	"libs/sinon"
], (chai, PM, User, Project, AccountManager, Helpers) ->
	should = chai.should()

	describe "ProjectMembersManager", ->
		beforeEach ->
			@socket = new Helpers.SocketIoMock()
			@ide =
				socket: @socket
				mainAreaManager:
					addArea: sinon.stub()
				sideBarView:
					addLink: sinon.stub()
				tabManager:
					addTab: sinon.stub()
			_.extend(@ide, Backbone.Events)
			@projectMembersManager = new PM.ProjectMembersManager @ide
			@project = new Project {
				_id : "project-1"
				owner:
					_id        : 1
					email      : "owner@example.com"
					privileges : "owner"
				members : [{
					_id        : 2
					email      : "readonly@example.com"
					privileges : "readOnly"
				},
				{
					_id        : 3
					email      : "readwrite@example.com"
					privileges : "readAndWrite"
				}]
				features:
					collaborators: -1
				rootFolder: [
					_id: "root-folder-id"
					name: "root-folder"
					docs: []
					folders: []
					fileRefs: []
				]
			}, {
				parse: true
			}
			@ide.project = @project
			@project.set "ide", @ide

		describe "when the project loaded is owned by the user", ->
			beforeEach ->
				@ide.security =
					permissionsLevel: "owner"
				@ide.trigger "afterJoinProject", @project

			it "should show the admin controls on the member list", ->
				@projectMembersManager.view.options.showAdminControls.should.equal true

		describe "when the project loaded is not owned by the user", ->
			beforeEach ->
				@ide.security =
					permissionsLevel: "readAndWrite"
				@ide.project = @project
				@ide.trigger "afterJoinProject", @project
				
			it "should socket show the admin controls on the member list", ->
				@projectMembersManager.view.options.showAdminControls.should.equal false

		describe "when the project is loaded with too many collaborators", ->
			beforeEach ->
				@project.get("features").collaborators = 1
				sinon.stub AccountManager, "showUpgradeDialog"
				@ide.project = @project
				@ide.trigger "afterJoinProject", @project

			afterEach ->
				AccountManager.showUpgradeDialog.restore()

			it "should show the upgrade dialog", ->
				AccountManager.showUpgradeDialog.called.should.equal true
				options = AccountManager.showUpgradeDialog.args[0][1]
				options.message.should.equal "This project has too many collaborators for your plan. Please upgrade your account or remove some collaborators"

		describe "when the project is loaded", ->
			beforeEach ->
				@ide.project = @project
				@ide.trigger "afterJoinProject", @project
			
			describe "when a member is removed client-side", ->
				beforeEach ->
					@socket.on "removeUserFromProject", @removeUserFromProject = sinon.spy()
					@projectMembersManager.removeMember id: "member-123"
					
				it "should call socket.removeUserFromProject", ->
					@removeUserFromProject.calledWith("member-123").should.equal true

			describe "when a member is removed server-side", ->
				beforeEach ->
					@projectMembersManager.members.add new User
						id: "user-1"
					@projectMembersManager.members.add new User
						id: "user-2"
					@ide.socket.emit "userRemovedFromProject", "user-1"

				it "should remove the member", ->
					for member in @projectMembersManager.members.models
						member.id.should.not.equal "user-1"

			describe "when a member is added client-side", ->
				describe "successfully", ->
					beforeEach ->
						@socket.on "addUserToProject", @addUserToProject =
							sinon.stub().callsArgWith(2, null, true)
						@projectMembersManager.addMember "new-member@example.com", "readAndWrite"

					it "should call socket.addUserToProject", ->
						@addUserToProject
							.calledWith("new-member@example.com", "readAndWrite")
							.should.equal true

				describe "when the user needs to upgrade", ->
					beforeEach ->
						@socket.on "addUserToProject", @addUserToProject =
							sinon.stub().callsArgWith(2, null, false)
						sinon.stub AccountManager, "askToUpgrade", (ide, options) ->
							ide.project.set("features", collaborators: 5)
						@projectMembersManager.addMember "new-member@example.com", "readAndWrite"
					
					afterEach ->
						AccountManager.askToUpgrade.restore()

					it "should start the user on their free trial", ->
						AccountManager.askToUpgrade.called.should.equal true
					
			describe "when a member is added server-side", ->
				beforeEach ->
					@socket.emit "userAddedToProject",
						_id: "new-user-1"
						email: "new-user@example.com",
						"readOnly"

				it "should add a member", ->
					for possibleMember in @projectMembersManager.members.models
						if possibleMember.id == "new-user-1"
							member = possibleMember
					should.exist member
					member.get("email").should.equal "new-user@example.com"
					member.get("privileges").should.equal "readOnly"

	describe "ProjectMembersView", ->
		beforeEach ->
			@socket = new Helpers.SocketIoMock()
			@ide =
				socket: @socket
				mainAreaManager:
					addArea: sinon.stub()
				sideBarView:
					addLink: sinon.stub()
				tabManager:
					addTab: sinon.stub()
			_.extend(@ide, Backbone.Events)
			@projectMembersManager = new PM.ProjectMembersManager(@ide)
			@collection = new PM.ProjectMemberList()
			@view = new PM.ProjectMemberListView
				collection: @collection
				manager: @projectMembersManager
			@view.render()
			$("#test-area").append(@view.$el)

		afterEach ->
			@view.$el.remove()

		describe "when formatting privileges", ->
			it "should format the read-write privileges nicely", ->
				@collection.add new User email: "test1@example.com", privileges: "readAndWrite"
				@view.$(".projectMember").find(".privileges").text().should.equal "Read and Write"

			it "should format the read-only privileges nicely", ->
				@collection.add new User email: "test1@example.com", privileges: "readOnly"
				@view.$(".projectMember").find(".privileges").text().should.equal "Read Only"

			it "should format the owner privileges nicely", ->
				@collection.add new User email: "test1@example.com", privileges: "owner"
				@view.$(".projectMember").find(".privileges").text().should.equal "Owner"

		describe "when the collection already has entries when the view is rendered", ->
			beforeEach ->
				@collection.add new User email: "test1@example.com", privileges: "readAndWrite"
				@view.render()

			it "should render the member in the view", ->
				@view.$(".projectMember").find(".email").text().should.equal "test1@example.com"

		describe "when the collection is updated", ->
			describe "by adding a member", ->
				beforeEach ->
					@collection.add new User email: "test1@example.com", privileges: "readAndWrite"

				it "should add the member to view", ->
					@view.$(".projectMember").find(".email").text().should.equal "test1@example.com"

			describe "by removing a member", ->
				beforeEach ->
					@member = new User email: "test1@example.com", privileges: "readAndWrite"
					@collection.add @member
					@collection.remove @member

				it "should remove the user from the view", ->
					@view.$(".projectMember").length.should.equal 0

		describe "with admin controls", ->
			beforeEach ->
				@view.options.showAdminControls = true
				@view.render()

			it "should show the remove link for members", ->
				@collection.add new User email: "test1@example.com", privileges: "readAndWrite"
				@view.$(".projectMember").find(".removeUser").length.should.equal 1

			it "should not show the remove link for the owner", ->
				@collection.add new User email: "test1@example.com", privileges: "owner"
				@view.$(".projectMember").find(".removeUser").length.should.equal 0

			it "should show the form to add a member", ->
				@view.$(".addUser").length.should.equal 1

		describe "without admin controls", ->
			it "should not show the remove link for members", ->
				@collection.add new User email: "test1@example.com", privileges: "readAndWrite"
				@view.$(".projectMember").find(".removeUser").length.should.equal 0

			it "should not show the form to add a member", ->
				@view.$(".addUser").length.should.equal 0

		describe "when removing a user", ->
			beforeEach ->
				sinon.stub @projectMembersManager, "removeMember", (user) ->
				@view.options.showAdminControls = true
				@member = new User email: "test1@example.com", privileges: "readAndWrite"
				@collection.add @member

			describe "when the remove link is clicked", ->
				beforeEach -> @view.$(".projectMember").find(".removeUser").click()
				
				it "should remove the user", ->
					@projectMembersManager.removeMember.called.should.equal true
					@projectMembersManager.removeMember.calledWith(@member).should.equal true
		
		describe "when adding a user", ->
			beforeEach ->
				sinon.stub @projectMembersManager, "addMember", (email, privileges) ->
				@view.options.showAdminControls = true
				@view.render()


			describe "when the add user button is clicked", ->
				beforeEach ->
					@view.$(".email").val("new-user@example.com")
					@view.$(".privileges").val("readOnly")
					@view.$(".addUser").click()
				
				it "should add a user", ->
					@projectMembersManager.addMember.called.should.equal true
					@projectMembersManager.addMember.calledWith("new-user@example.com", "readOnly").should.equal true

				it "should reset the email address", ->
					@view.$(".email").val().should.equal ""


