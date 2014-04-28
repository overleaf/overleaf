should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Project/ProjectController"
expect = require("chai").expect

describe "ProjectController", ->

	beforeEach ->

		@project_id = "123213jlkj9kdlsaj"

		@settings = 
			apis:
				chat:
					url:"chat.com"
			siteUrl: "mysite.com"
		@ProjectDeleter = 
			deleteProject: sinon.stub().callsArgWith(1)
		@ProjectDuplicator =
			duplicate: sinon.stub().callsArgWith(3, null, {_id:@project_id})
		@ProjectCreationHandler =
			createExampleProject: sinon.stub().callsArgWith(2, null, {_id:@project_id})
			createBasicProject: sinon.stub().callsArgWith(2, null, {_id:@project_id})
		@SubscriptionLocator =
			getUsersSubscription: sinon.stub()
		@TagsHandler =
			getAllTags: sinon.stub()
		@ProjectModel =
			findAllUsersProjects: sinon.stub()
			findPopulatedById: sinon.stub()
		@UserModel =
			findById: sinon.stub()
		@SecurityManager =
			userCanAccessProject:sinon.stub()
		@EditorController = 
			renameProject:sinon.stub()
		@ProjectController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				err:->
			"./ProjectDeleter": @ProjectDeleter
			"./ProjectDuplicator": @ProjectDuplicator
			"./ProjectCreationHandler": @ProjectCreationHandler
			"../Editor/EditorController": @EditorController
			"../Subscription/SubscriptionLocator": @SubscriptionLocator
			"../Tags/TagsHandler":@TagsHandler
			'../../models/Project': Project:@ProjectModel
			"../../models/User":User:@UserModel
			"../../managers/SecurityManager":@SecurityManager

		@user = 
			_id:"!£123213kjljkl"
			first_name: "bjkdsjfk"
		@projectName = "£12321jkj9ujkljds"
		@req = 
			params: 
				Project_id: @project_id
			session:
				user: @user
			body:
				projectName: @projectName 
		@res = 
			locals:
				jsPath:"js path here"

	describe "deleteProject", ->

		it "should tell the project deleter", (done)->

			@res.send = (code)=>
				@ProjectDeleter.deleteProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.deleteProject @req, @res


	describe "cloneProject", ->

		it "should call the project duplicator", (done)->	
			@res.send = (json)=>
				@ProjectDuplicator.duplicate.calledWith(@user, @project_id, @projectName).should.equal true
				json.project_id.should.equal @project_id
				done()
			@ProjectController.cloneProject @req, @res

	describe "newProject", ->

		it "should call the projectCreationHandler with createExampleProject", (done)->
			@req.body.template = "example"
			@res.send = (json)=>
				@ProjectCreationHandler.createExampleProject.calledWith(@user._id, @projectName).should.equal true
				@ProjectCreationHandler.createBasicProject.called.should.equal false
				done()
			@ProjectController.newProject @req, @res


		it "should call the projectCreationHandler with createBasicProject", (done)->
			@req.body.template = "basic"
			@res.send = (json)=>
				@ProjectCreationHandler.createExampleProject.called.should.equal false
				@ProjectCreationHandler.createBasicProject.calledWith(@user._id, @projectName).should.equal true
				done()
			@ProjectController.newProject @req, @res

	describe "projectListPage", ->

		beforeEach ->
			@tags = [{name:1, project_ids:["1","2","3"]}, {name:2, project_ids:["a","1"]}, {name:3, project_ids:["a", "b", "c", "d"]}]
			@projects = [{lastUpdated:1, _id:1}, {lastUpdated:2, _id:2}]
			@collabertions = [{lastUpdated:5, _id:5}]
			@readOnly = [{lastUpdated:3, _id:3}]
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
			@TagsHandler.getAllTags.callsArgWith(1, null, @tags, {})
			@ProjectModel.findAllUsersProjects.callsArgWith(2, null, @projects, @collabertions, @readOnly)

		it "should render the project/list page", (done)->
			@res.render = (pageName, opts)=>
				pageName.should.equal "project/list"
				done()
			@ProjectController.projectListPage @req, @res

		it "should send the tags", (done)->
			@res.render = (pageName, opts)=>
				opts.tags.length.should.equal @tags.length
				done()
			@ProjectController.projectListPage @req, @res

		it "should send the projects", (done)->
			@res.render = (pageName, opts)=>
				opts.projects.length.should.equal (@projects.length + @collabertions.length + @readOnly.length)
				done()
			@ProjectController.projectListPage @req, @res

	describe "renameProject", ->
		beforeEach ->
			@newProjectName = "my supper great new project"
			@req.body.newProjectName = @newProjectName

		it "should call the editor controller", (done)->
			@EditorController.renameProject.callsArgWith(2)
			@res.send = (code)=>
				code.should.equal 200
				@EditorController.renameProject.calledWith(@project_id, @newProjectName).should.equal true
				done()
			@ProjectController.renameProject @req, @res

		it "should send a 500 if there is a problem", (done)->
			@EditorController.renameProject.callsArgWith(2, "problem")
			@res.send = (code)=>
				code.should.equal 500
				@EditorController.renameProject.calledWith(@project_id, @newProjectName).should.equal true
				done()
			@ProjectController.renameProject @req, @res

	describe "loadEditor", ->
		beforeEach ->
			@settings.editorIsOpen = true
			@project = 
				name:"my proj"
				_id:"213123kjlkj"
			@user = 
				_id:"123kj21k3lj"
				ace:
					fontSize:"massive"
					theme:"sexy"
				email: "bob@bob.com"
			@ProjectModel.findPopulatedById.callsArgWith 1, null, @project
			@UserModel.findById.callsArgWith(1, null, @user)
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
			@SecurityManager.userCanAccessProject.callsArgWith 2, true, "owner"

		it "should render the project/editor page", (done)->
			@res.render = (pageName, opts)=>
				pageName.should.equal "project/editor"
				done()
			@ProjectController.loadEditor @req, @res

		it "should add the project onto the opts", (done)->		
			@res.render = (pageName, opts)=>
				opts.project.should.equal @project
				done()
			@ProjectController.loadEditor @req, @res

		it "should add userObject", (done)->
			@res.render = (pageName, opts)=>
				userObject = JSON.parse(opts.userObject)
				userObject.email.should.equal @user.email
				done()
			@ProjectController.loadEditor @req, @res

		it "should add on userSettingsObject", (done)->
			@res.render = (pageName, opts)=>
				userSettingsObject = JSON.parse(opts.userSettingsObject)
				userSettingsObject.project_id.should.equal @project._id
				userSettingsObject.fontSize.should.equal @user.ace.fontSize
				userSettingsObject.theme.should.equal @user.ace.theme
				done()
			@ProjectController.loadEditor @req, @res

		it "should add sharelatexObject", (done)->
			@res.render = (pageName, opts)=>
				sharelatexObject = JSON.parse(opts.sharelatexObject)
				sharelatexObject.siteUrl.should.equal @settings.siteUrl
				done()
			@ProjectController.loadEditor @req, @res

		it "should render the closed page if the editor is closed", (done)->
			@settings.editorIsOpen = false
			@res.render = (pageName, opts)=>
				pageName.should.equal "general/closed"
				done()
			@ProjectController.loadEditor @req, @res

		it "should not render the page if the project can not be accessed", (done)->
			@SecurityManager.userCanAccessProject = sinon.stub().callsArgWith 2, false
			@res.send = (resCode, opts)=>
				resCode.should.equal 401
				done()
			@ProjectController.loadEditor @req, @res
