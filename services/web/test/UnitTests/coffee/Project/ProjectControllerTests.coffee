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

		@user =
			_id:"588f3ddae8ebc1bac07c9fa4"
			first_name: "bjkdsjfk"
		@settings =
			apis:
				chat:
					url:"chat.com"
			siteUrl: "mysite.com"
		@token = 'some-token'
		@ProjectDeleter =
			archiveProject: sinon.stub().callsArg(1)
			deleteProject: sinon.stub().callsArg(1)
			restoreProject: sinon.stub().callsArg(1)
			findArchivedProjects: sinon.stub()
		@ProjectDuplicator =
			duplicate: sinon.stub().callsArgWith(3, null, {_id:@project_id})
		@ProjectCreationHandler =
			createExampleProject: sinon.stub().callsArgWith(2, null, {_id:@project_id})
			createBasicProject: sinon.stub().callsArgWith(2, null, {_id:@project_id})
		@SubscriptionLocator =
			getUsersSubscription: sinon.stub()
		@LimitationsManager =
			userHasSubscriptionOrIsGroupMember: sinon.stub()
		@TagsHandler =
			getAllTags: sinon.stub()
		@NotificationsHandler =
			getUserNotifications: sinon.stub()
		@UserModel =
			findById: sinon.stub()
		@AuthorizationManager =
			getPrivilegeLevelForProject:sinon.stub()
		@EditorController =
			renameProject:sinon.stub()
		@InactiveProjectManager =
			reactivateProjectIfRequired:sinon.stub()
		@ProjectUpdateHandler =
			markAsOpened: sinon.stub()
		@ReferencesSearchHandler =
			indexProjectReferences: sinon.stub()
		@ProjectGetter =
			findAllUsersProjects: sinon.stub()
			getProject: sinon.stub()
		@V1ProjectGetter =
			findAllUsersProjects: sinon.stub()
		@AuthenticationController =
			getLoggedInUser: sinon.stub().callsArgWith(1, null, @user)
			getLoggedInUserId: sinon.stub().returns(@user._id)
			getSessionUser: sinon.stub().returns(@user)
			isUserLoggedIn: sinon.stub().returns(true)
		@AnalyticsManager =
			getLastOccurance: sinon.stub()
		@TokenAccessHandler =
			getRequestToken: sinon.stub().returns(@token)
			protectTokens: sinon.stub()
		@CollaboratorsHandler =
			userIsTokenMember: sinon.stub().callsArgWith(2, null, false)
		@ProjectController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex":
				log:->
				err:->
			"metrics-sharelatex":
				Timer:->
					done:->
				inc:->
			"./ProjectDeleter": @ProjectDeleter
			"./ProjectDuplicator": @ProjectDuplicator
			"./ProjectCreationHandler": @ProjectCreationHandler
			"../Editor/EditorController": @EditorController
			"../Subscription/SubscriptionLocator": @SubscriptionLocator
			"../Subscription/LimitationsManager": @LimitationsManager
			"../Tags/TagsHandler":@TagsHandler
			"../Notifications/NotificationsHandler":@NotificationsHandler
			"../../models/User":User:@UserModel
			"../Authorization/AuthorizationManager":@AuthorizationManager
			"../InactiveData/InactiveProjectManager":@InactiveProjectManager
			"./ProjectUpdateHandler":@ProjectUpdateHandler
			"../ReferencesSearch/ReferencesSearchHandler": @ReferencesSearchHandler
			"./ProjectGetter": @ProjectGetter
			'./V1ProjectGetter': @V1ProjectGetter
			'../Authentication/AuthenticationController': @AuthenticationController
			"../Analytics/AnalyticsManager": @AnalyticsManager
			"../TokenAccess/TokenAccessHandler": @TokenAccessHandler
			"../Collaborators/CollaboratorsHandler": @CollaboratorsHandler

		@projectName = "£12321jkj9ujkljds"
		@req =
			params:
				Project_id: @project_id
			session:
				user: @user
			body:
				projectName: @projectName
			i18n:
				translate:->
		@res =
			locals:
				jsPath:"js path here"

	describe "updateProjectSettings", ->
		it "should update the name", (done) ->
			@EditorController.renameProject = sinon.stub().callsArg(2)
			@req.body =
				name: @name = "New name"
			@res.sendStatus = (code) =>
				@EditorController.renameProject
					.calledWith(@project_id, @name)
					.should.equal true
				code.should.equal 204
				done()
			@ProjectController.updateProjectSettings @req, @res

		it "should update the compiler", (done) ->
			@EditorController.setCompiler = sinon.stub().callsArg(2)
			@req.body =
				compiler: @compiler = "pdflatex"
			@res.sendStatus = (code) =>
				@EditorController.setCompiler
					.calledWith(@project_id, @compiler)
					.should.equal true
				code.should.equal 204
				done()
			@ProjectController.updateProjectSettings @req, @res

		it "should update the spell check language", (done) ->
			@EditorController.setSpellCheckLanguage = sinon.stub().callsArg(2)
			@req.body =
				spellCheckLanguage: @languageCode = "fr"
			@res.sendStatus = (code) =>
				@EditorController.setSpellCheckLanguage
					.calledWith(@project_id, @languageCode)
					.should.equal true
				code.should.equal 204
				done()
			@ProjectController.updateProjectSettings @req, @res

		it "should update the root doc", (done) ->
			@EditorController.setRootDoc = sinon.stub().callsArg(2)
			@req.body =
				rootDocId: @rootDocId = "root-doc-id"
			@res.sendStatus = (code) =>
				@EditorController.setRootDoc
					.calledWith(@project_id, @rootDocId)
					.should.equal true
				code.should.equal 204
				done()
			@ProjectController.updateProjectSettings @req, @res

	describe "updateProjectAdminSettings", ->
		it "should update the public access level", (done) ->
			@EditorController.setPublicAccessLevel = sinon.stub().callsArg(2)
			@req.body =
				publicAccessLevel: @publicAccessLevel = "readonly"
			@res.sendStatus = (code) =>
				@EditorController.setPublicAccessLevel
					.calledWith(@project_id, @publicAccessLevel)
					.should.equal true
				code.should.equal 204
				done()
			@ProjectController.updateProjectAdminSettings @req, @res

	describe "deleteProject", ->
		it "should tell the project deleter to archive when forever=false", (done)->
			@res.sendStatus = (code)=>
				@ProjectDeleter.archiveProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.deleteProject @req, @res

		it "should tell the project deleter to delete when forever=true", (done)->
			@req.query = forever: "true"
			@res.sendStatus = (code)=>
				@ProjectDeleter.deleteProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.deleteProject @req, @res

	describe "restoreProject", ->
		it "should tell the project deleter", (done)->
			@res.sendStatus = (code)=>
				@ProjectDeleter.restoreProject.calledWith(@project_id).should.equal true
				code.should.equal 200
				done()
			@ProjectController.restoreProject @req, @res

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
			@notifications = [{_id:'1',user_id:'2',templateKey:'3',messageOpts:'4',key:'5'}]
			@projects = [
				{_id:1, lastUpdated:1, owner_ref: "user-1"},
				{_id:2, lastUpdated:2, owner_ref: "user-2"}
			]
			@collabertions = [
				{_id:5, lastUpdated:5, owner_ref: "user-1"}
			]
			@readOnly = [
				{_id:3, lastUpdated:3, owner_ref: "user-1"}
			]
			@tokenReadAndWrite = [
				{_id:6, lastUpdated:5, owner_ref: "user-4"}
			]
			@tokenReadOnly = [
				{_id:7, lastUpdated:4, owner_ref: "user-5"}
			]
			@allProjects = {
				owned: @projects,
				readAndWrite: @collabertions,
				readOnly: @readOnly,
				tokenReadAndWrite: @tokenReadAndWrite,
				tokenReadOnly: @tokenReadOnly
			}

			@users =
				'user-1':
					first_name: 'James'
				'user-2':
					first_name: 'Henry'
			@users[@user._id] = @user # Owner
			@UserModel.findById = (id, fields, callback) =>
				callback null, @users[id]

			@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, false)
			@TagsHandler.getAllTags.callsArgWith(1, null, @tags, {})
			@NotificationsHandler.getUserNotifications = sinon.stub().callsArgWith(1, null, @notifications, {})
			@ProjectGetter.findAllUsersProjects.callsArgWith(2, null, @allProjects)
			@V1ProjectGetter.findAllUsersProjects.callsArg(1) # Without integration module cb returns without args

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
				opts.projects.length.should.equal (@projects.length + @collabertions.length + @readOnly.length + @tokenReadAndWrite.length + @tokenReadOnly.length)
				done()
			@ProjectController.projectListPage @req, @res

		it "should send the user", (done)->
			@res.render = (pageName, opts)=>
				opts.user.should.deep.equal @user
				done()
			@ProjectController.projectListPage @req, @res

		it "should inject the users", (done) ->
			@res.render = (pageName, opts)=>
				opts.projects[0].owner.should.equal (@users[@projects[0].owner_ref])
				opts.projects[1].owner.should.equal (@users[@projects[1].owner_ref])
				done()
			@ProjectController.projectListPage @req, @res

		describe 'with overleaf-integration-web-module', ->
			beforeEach ->
				@V1Response =
					projects: [
						{ id: '123mockV1Id', title: 'mock title', updated_at: 1509616411, removed: false, archived: false }
						{ id: '456mockV1Id', title: 'mock title 2', updated_at: 1509616411, removed: true, archived: false }
					],
					tags: [
						{ name: 'mock tag', project_ids: ['123mockV1Id'] }
					]
				@V1ProjectGetter.findAllUsersProjects.callsArgWith(1, null, @V1Response)

			it 'should include V1 projects', (done) ->
				@res.render = (pageName, opts) =>
					opts.projects.length.should.equal (
						@projects.length +
						@collabertions.length +
						@readOnly.length +
						@tokenReadAndWrite.length +
						@tokenReadOnly.length +
						@V1Response.projects.length
					)
					opts.projects.forEach (p) ->
						# Check properties correctly mapped from V1
						expect(p).to.have.property 'id'
						expect(p).to.have.property 'name'
						expect(p).to.have.property 'lastUpdated'
						expect(p).to.have.property 'accessLevel'
						expect(p).to.have.property 'archived'
					done()
				@ProjectController.projectListPage @req, @res

			it 'should include V1 tags', (done) ->
				@res.render = (pageName, opts) =>
					opts.tags.length.should.equal (@tags.length + @V1Response.tags.length)
					opts.tags.forEach (t) ->
						expect(t).to.have.property 'name'
						expect(t).to.have.property 'project_ids'
					done()
				@ProjectController.projectListPage @req, @res

			it 'should have isShowingV1Projects flag', (done) ->
				@res.render = (pageName, opts) =>
					opts.isShowingV1Projects.should.equal true
					done()
				@ProjectController.projectListPage @req, @res

	describe "projectListPage with duplicate projects", ->

		beforeEach ->
			@tags = [{name:1, project_ids:["1","2","3"]}, {name:2, project_ids:["a","1"]}, {name:3, project_ids:["a", "b", "c", "d"]}]
			@notifications = [{_id:'1',user_id:'2',templateKey:'3',messageOpts:'4',key:'5'}]
			@projects = [
				{_id:1, lastUpdated:1, owner_ref: "user-1"},
				{_id:2, lastUpdated:2, owner_ref: "user-2"}
			]
			@collabertions = [
				{_id:5, lastUpdated:5, owner_ref: "user-1"}
			]
			@readOnly = [
				{_id:3, lastUpdated:3, owner_ref: "user-1"}
			]
			@tokenReadAndWrite = [
				{_id:6, lastUpdated:5, owner_ref: "user-4"}
			]
			@tokenReadOnly = [
				{_id:6, lastUpdated:5, owner_ref: "user-4"} # Also in tokenReadAndWrite
				{_id:7, lastUpdated:4, owner_ref: "user-5"}
			]
			@allProjects = {
				owned: @projects,
				readAndWrite: @collabertions,
				readOnly: @readOnly,
				tokenReadAndWrite: @tokenReadAndWrite,
				tokenReadOnly: @tokenReadOnly
			}

			@users =
				'user-1':
					first_name: 'James'
				'user-2':
					first_name: 'Henry'
			@users[@user._id] = @user # Owner
			@UserModel.findById = (id, fields, callback) =>
				callback null, @users[id]

			@LimitationsManager.userHasSubscriptionOrIsGroupMember.callsArgWith(1, null, false)
			@TagsHandler.getAllTags.callsArgWith(1, null, @tags, {})
			@NotificationsHandler.getUserNotifications = sinon.stub().callsArgWith(1, null, @notifications, {})
			@ProjectGetter.findAllUsersProjects.callsArgWith(2, null, @allProjects)
			@V1ProjectGetter.findAllUsersProjects.callsArg(1) # Without integration module cb returns without args

		it "should render the project/list page", (done)->
			@res.render = (pageName, opts)=>
				pageName.should.equal "project/list"
				done()
			@ProjectController.projectListPage @req, @res

		it "should omit one of the projects", (done)->
			@res.render = (pageName, opts)=>
				opts.projects.length.should.equal (
					@projects.length + @collabertions.length + @readOnly.length + @tokenReadAndWrite.length + @tokenReadOnly.length - 1
				)
				done()
			@ProjectController.projectListPage @req, @res

	describe "renameProject", ->
		beforeEach ->
			@newProjectName = "my supper great new project"
			@req.body.newProjectName = @newProjectName

		it "should call the editor controller", (done)->
			@EditorController.renameProject.callsArgWith(2)
			@res.sendStatus = (code)=>
				code.should.equal 200
				@EditorController.renameProject.calledWith(@project_id, @newProjectName).should.equal true
				done()
			@ProjectController.renameProject @req, @res

		it "should send an error to next() if there is a problem", (done)->
			@EditorController.renameProject.callsArgWith(2, error = new Error("problem"))
			next = (e)=>
				e.should.equal error
				done()
			@ProjectController.renameProject @req, @res, next

	describe "loadEditor", ->
		beforeEach ->
			@settings.editorIsOpen = true
			@project =
				name:"my proj"
				_id:"213123kjlkj"
				owner_ref: '59fc84d5fbea77482d436e1b'
			@user =
				_id: "588f3ddae8ebc1bac07c9fa4"
				ace:
					fontSize:"massive"
					theme:"sexy"
				email: "bob@bob.com"
			@ProjectGetter.getProject.callsArgWith 2, null, @project
			@UserModel.findById.callsArgWith(1, null, @user)
			@SubscriptionLocator.getUsersSubscription.callsArgWith(1, null, {})
			@AuthorizationManager.getPrivilegeLevelForProject.callsArgWith 3, null, "owner"
			@ProjectDeleter.unmarkAsDeletedByExternalSource = sinon.stub()
			@InactiveProjectManager.reactivateProjectIfRequired.callsArgWith(1)
			@AnalyticsManager.getLastOccurance.yields(null, {"mock": "event"})
			@ProjectUpdateHandler.markAsOpened.callsArgWith(1)

		it "should render the project/editor page", (done)->
			@res.render = (pageName, opts)=>
				pageName.should.equal "project/editor"
				done()
			@ProjectController.loadEditor @req, @res

		it "should add user", (done)->
			@res.render = (pageName, opts)=>
				opts.user.email.should.equal @user.email
				done()
			@ProjectController.loadEditor @req, @res

		it "should add on userSettings", (done)->
			@res.render = (pageName, opts)=>
				opts.userSettings.fontSize.should.equal @user.ace.fontSize
				opts.userSettings.theme.should.equal @user.ace.theme
				done()
			@ProjectController.loadEditor @req, @res

		it "should render the closed page if the editor is closed", (done)->
			@settings.editorIsOpen = false
			@res.render = (pageName, opts)=>
				pageName.should.equal "general/closed"
				done()
			@ProjectController.loadEditor @req, @res

		it "should not render the page if the project can not be accessed", (done)->
			@AuthorizationManager.getPrivilegeLevelForProject = sinon.stub().callsArgWith 3, null, null
			@res.sendStatus = (resCode, opts)=>
				resCode.should.equal 401
				done()
			@ProjectController.loadEditor @req, @res

		it "should reactivateProjectIfRequired", (done)->
			@res.render = (pageName, opts)=>
				@InactiveProjectManager.reactivateProjectIfRequired.calledWith(@project_id).should.equal true
				done()
			@ProjectController.loadEditor @req, @res

		it "should mark project as opened", (done)->
			@res.render = (pageName, opts)=>
				@ProjectUpdateHandler.markAsOpened.calledWith(@project_id).should.equal true
				done()
			@ProjectController.loadEditor @req, @res
		
		it "should set showTrackChangesOnboarding = false if there is an event", (done) ->
			@AnalyticsManager.getLastOccurance.yields(null, {"mock": "event"})
			@res.render = (pageName, opts)=>
				opts.showTrackChangesOnboarding.should.equal false
				done()
			@ProjectController.loadEditor @req, @res
		
		it "should set showTrackChangesOnboarding = true if there is no event", (done) ->
			@AnalyticsManager.getLastOccurance.yields(null, null)
			@res.render = (pageName, opts)=>
				opts.showTrackChangesOnboarding.should.equal true
				done()
			@ProjectController.loadEditor @req, @res
		
		it "should set showTrackChangesOnboarding = false if there is an error", (done) ->
			@AnalyticsManager.getLastOccurance.yields(new Error("oops"), null)
			@res.render = (pageName, opts)=>
				opts.showTrackChangesOnboarding.should.equal false
				done()
			@ProjectController.loadEditor @req, @res
		
		it "should set showTrackChangesOnboarding = false if the user signed up after release", (done) ->
			@AuthenticationController.getLoggedInUserId.returns("58c11a608ba0d6e49e8ce5d5")
			@AnalyticsManager.getLastOccurance.yields(null, null)
			@res.render = (pageName, opts)=>
				opts.showTrackChangesOnboarding.should.equal false
				done()
			@ProjectController.loadEditor @req, @res

	describe '_isInPercentageRollout', ->
		before ->
			@ids = [
				'5a05cd7621f9fe22be131740',
				'5a05cd7821f9fe22be131741',
				'5a05cd7921f9fe22be131742',
				'5a05cd7a21f9fe22be131743',
				'5a05cd7b21f9fe22be131744',
				'5a05cd7c21f9fe22be131745',
				'5a05cd7d21f9fe22be131746',
				'5a05cd7e21f9fe22be131747',
				'5a05cd7f21f9fe22be131748',
				'5a05cd8021f9fe22be131749',
				'5a05cd8021f9fe22be13174a',
				'5a05cd8121f9fe22be13174b',
				'5a05cd8221f9fe22be13174c',
				'5a05cd8221f9fe22be13174d',
				'5a05cd8321f9fe22be13174e',
				'5a05cd8321f9fe22be13174f',
				'5a05cd8421f9fe22be131750',
				'5a05cd8421f9fe22be131751',
				'5a05cd8421f9fe22be131752',
				'5a05cd8521f9fe22be131753'
			]

		it 'should produce the expected results', ->
			expect(
				@ids.map (i) =>
					@ProjectController._isInPercentageRollout('abcd', i, 50)
			).to.deep.equal [
				false,
				false,
				false,
				false,
				false,
				false,
				true,
				false,
				true,
				true,
				true,
				true,
				true,
				true,
				false,
				false,
				false,
				true,
				false,
				true
				]
			expect(
				@ids.map (i) =>
					@ProjectController._isInPercentageRollout('efgh', i, 50)
			).to.deep.equal [
				false,
				false,
				false,
				false,
				true,
				false,
				false,
				true,
				false,
				false,
				true,
				true,
				true,
				false,
				true,
				false,
				true,
				true,
				false,
				false
			]


