define [
	"libs/chai"
	"models/Project"
	"models/ProjectMemberList"
	"models/User"
	"tests/unit/helpers"
	"libs/sinon"
], (chai, Project, ProjectMemberList, User, Helpers) ->
	should = chai.should()


	describe "Project", ->
		beforeEach ->
			@socket = new Helpers.SocketIoMock()

		describe "parsing", ->
			beforeEach ->
				@socket.on "setProjectName", @setProjectName = sinon.spy()
				@socket.on "setPublicAccessLevel", @setPublicAccessLevel = sinon.spy()
				@socket.on "setCompiler", @setCompiler = sinon.spy()
				@socket.on "setRootDoc", @setRootDoc = sinon.spy()
				@project = new Project {
					_id              : "project-1"
					rootDoc_id       : "root-doc-id"
					name             : "Project Name"
					publicAccesLevel : "readOnly"
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
						versioning: true
						collaborators: 3
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
				@project.set "ide", socket: @socket

			it "should set the id", ->
				@project.id.should.equal "project-1"

			it "should set the name without calling socket.setProjectName", ->
				@project.get("name").should.equal "Project Name"
				@setProjectName.called.should.equal false

			it "should set the public access level without called socket.setPublicAccessLevel", ->
				@project.get("publicAccesLevel").should.equal "readOnly"
				@setPublicAccessLevel.called.should.equal false

			it "should create a collection of collaborators", ->
				should.exist @project.get("members")
				(@project.get("members") instanceof ProjectMemberList).should.equal true

				members = @project.get("members").models
				members[0].id.should.equal 1
				members[0].get("email").should.equal "owner@example.com"
				members[0].get("privileges").should.equal "owner"
				members[1].id.should.equal 2
				members[1].get("email").should.equal "readonly@example.com"
				members[1].get("privileges").should.equal "readOnly"
				members[2].id.should.equal 3
				members[2].get("email").should.equal "readwrite@example.com"
				members[2].get("privileges").should.equal "readAndWrite"

			it "should create an owner model", ->
				should.exist @project.get("owner")
				(@project.get("owner") instanceof User).should.equal true
				@project.get("owner").get("privileges").should.equal "owner"

			it "should include the features", ->
				@project.get("features").should.deep.equal
					versioning: true
					collaborators: 3

			it "should set the rootDoc_id without calling socket.setRootDoc", ->
				@project.get("rootDoc_id").should.equal "root-doc-id"
				@setRootDoc.called.should.equal false

		describe "updating the root document", ->
			beforeEach ->
				@project = new Project
					id: "project-1",
					rootDoc_id: "old-root-doc-id"
				@project.set "ide", socket: @socket

			it "should call socket.setRootDoc when the root doc is changed", ->
				@socket.on "setRootDoc", @setRootDoc = sinon.spy()
				@project.set("rootDoc_id", "new-root-doc-id")
				@setRootDoc.calledWith("new-root-doc-id").should.equal true

			it "should update the root doc when socket.rootDocUpdated is called", ->
				@socket.emit "rootDocUpdated", "new-root-doc-id"
				@project.get("rootDoc_id").should.equal "new-root-doc-id"


		describe "updating the compiler the project uses", ->
			beforeEach ->
				@project = new Project
					id  : "project-1",
					compiler : "latex"
				@project.set "ide", socket: @socket
			
			it "should call socket.setCompiler when the compiler is changed", ->
				@socket.on "setCompiler", @setCompiler = sinon.spy()
				@project.set("compiler", "xetex")
				@setCompiler.calledWith("xetex").should.equal true

			it "should update the compiler when socket.compilerUpdated is called", ->
				@socket.emit "compilerUpdated", "xetex"
				@project.get("compiler").should.equal "xetex"

		describe "updating the project's name", ->
			beforeEach ->
				@project = new Project
					id  : "project-1",
					name : "Old Name"
				@project.set "ide", socket: @socket

			it "should call socket.setProjectName when the name is changed", ->
				@socket.on "setProjectName", @setProjectName = sinon.spy()
				@project.set("name", "New Name")
				@setProjectName.calledWith(window.window_id, "New Name").should.equal true

			it "should update the name when socket.projectNameUpdated is called", ->
				@socket.emit "projectNameUpdated", "window-id-2", "New Name"
				@project.get("name").should.equal "New Name"

		describe "updating the project's public access level", ->
			beforeEach ->
				@project = new Project
					id  : "project-1",
					publicAccesLevel : "readOnly"
				@project.set "ide", socket: @socket

			it "should call socket.setPublicAccessLevel when the level is changed", ->
				@socket.on "setPublicAccessLevel", @setPublicAccessLevel = sinon.spy()
				@project.set("publicAccesLevel", "readAndWrite")
				@setPublicAccessLevel.calledWith("readAndWrite").should.equal true

			it "should update the level when socket.publicAccessLevelUpdated is called", ->
				@socket.emit "publicAccessLevelUpdated", "readAndWrite"
				@project.get("publicAccesLevel").should.equal "readAndWrite"




