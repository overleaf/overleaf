spies = require('chai-spies')
chai = require('chai').use(spies)
sinon = require("sinon")
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Project/ProjectCreationHandler.js"
SandboxedModule = require('sandboxed-module')
Settings = require('settings-sharelatex')
Path = require "path"
_ = require("underscore")

describe 'ProjectCreationHandler', ->
	ownerId = '4eecb1c1bffa66588e0000a1'
	projectName = 'project name goes here'
	project_id = "4eecaffcbffa66588e000008"
	docId = '4eecb17ebffa66588e00003f'
	rootFolderId = "234adfa3r2afe"

	beforeEach ->
		@ProjectModel = class Project
			constructor:(options = {})->
				@._id = project_id
				@owner_ref = options.owner_ref
				@name = options.name
				@overleaf =
					history: {}
			save: sinon.stub().callsArg(0)
			rootFolder:[{
				_id: rootFolderId
				docs: []
			}]
		@FolderModel = class Folder
			constructor:(options)->
				{@name} = options
		@ProjectEntityUpdateHandler =
			addDoc: sinon.stub().callsArgWith(5, null, {_id: docId})
			addFile: sinon.stub().callsArg(6)
			setRootDoc: sinon.stub().callsArg(2)
		@ProjectDetailsHandler =
			validateProjectName: sinon.stub().yields()
		@HistoryManager =
			initializeProject: sinon.stub().callsArg(0)

		@user =
			first_name:"first name here"
			last_name:"last name here"
			ace:
				spellCheckLanguage:"de"

		@User = findById:sinon.stub().callsArgWith(2, null, @user)
		@callback = sinon.stub()

		@Settings = apis: { project_history: {} }

		@AnalyticsManger = recordEvent: sinon.stub()

		@handler = SandboxedModule.require modulePath, requires:
			'../../models/User': User:@User
			'../../models/Project':{Project:@ProjectModel}
			'../../models/Folder':{Folder:@FolderModel}
			'../History/HistoryManager': @HistoryManager
			'./ProjectEntityUpdateHandler':@ProjectEntityUpdateHandler
			"./ProjectDetailsHandler":@ProjectDetailsHandler
			"settings-sharelatex": @Settings
			"../Analytics/AnalyticsManager": @AnalyticsManger
			'logger-sharelatex': {log:->}
			"metrics-sharelatex": {
				inc: ()->,
				timeAsyncMethod: ()->
			}

	describe 'Creating a Blank project', ->
		beforeEach ->
			@overleaf_id = 1234
			@HistoryManager.initializeProject = sinon.stub().callsArgWith(0, null, { @overleaf_id })
			@ProjectModel::save = sinon.stub().callsArg(0)

		describe "successfully", ->
			it "should save the project", (done)->
				@handler.createBlankProject ownerId, projectName, =>
					@ProjectModel::save.called.should.equal true
					done()

			it "should return the project in the callback", (done)->
				@handler.createBlankProject ownerId, projectName, (err, project)->
					project.name.should.equal projectName
					(project.owner_ref + "").should.equal ownerId
					done()

			it "should initialize the project overleaf if history id not provided", (done)->
				@handler.createBlankProject ownerId, projectName, done
				@HistoryManager.initializeProject.calledWith().should.equal true

			it "should set the overleaf id if overleaf id not provided", (done)->
				@handler.createBlankProject ownerId, projectName, (err, project)=>
					project.overleaf.history.id.should.equal @overleaf_id
					done()

			it "should set the overleaf id if overleaf id provided", (done)->
				overleaf_id = 2345
				@handler.createBlankProject ownerId, projectName, overleaf_id, (err, project)->
					project.overleaf.history.id.should.equal overleaf_id
					done()

			it "should set the language from the user", (done)->
				@handler.createBlankProject ownerId, projectName, (err, project)->
					project.spellCheckLanguage.should.equal "de"
					done()

			it "should set the imageName to currentImageName if set", (done) ->
				@Settings.currentImageName = "mock-image-name"
				@handler.createBlankProject ownerId, projectName, (err, project)=>
					project.imageName.should.equal @Settings.currentImageName
					done()

			it "should not set the imageName if no currentImageName", (done) ->
				@Settings.currentImageName = null
				@handler.createBlankProject ownerId, projectName, (err, project)=>
					expect(project.imageName).to.not.exist
					done()

			it "should not set the overleaf.history.display if not configured in settings", (done) ->
				@Settings.apis.project_history.displayHistoryForNewProjects = false
				@handler.createBlankProject ownerId, projectName, (err, project)=>
					expect(project.overleaf.history.display).to.not.exist
					done()

			it "should set the overleaf.history.display if configured in settings", (done) ->
				@Settings.apis.project_history.displayHistoryForNewProjects = true
				@handler.createBlankProject ownerId, projectName, (err, project)=>
					expect(project.overleaf.history.display).to.equal true
					done()

		describe "with an error", ->
			beforeEach ->
				@ProjectModel::save = sinon.stub().callsArgWith(0, new Error("something went wrong"))
				@handler.createBlankProject ownerId, projectName, @callback

			it 'should return the error to the callback', ->
				should.exist @callback.args[0][0]

		describe "with an invalid name", ->
			beforeEach ->
				@ProjectDetailsHandler.validateProjectName = sinon.stub().yields(new Error("bad name"))
				@handler.createBlankProject ownerId, projectName, @callback

			it 'should return the error to the callback', ->
				should.exist @callback.args[0][0]

			it 'should not try to create the project', ->
				@ProjectModel::save.called.should.equal false


	describe 'Creating a basic project', ->
		beforeEach ->
			@project = new @ProjectModel()
			@handler._buildTemplate = (template_name, user, project_name, callback) ->
				if template_name == "mainbasic.tex"
					return callback(null, ["mainbasic.tex", "lines"])
				throw new Error("unknown template: #{template_name}")
			sinon.spy @handler, "_buildTemplate"
			@handler.createBlankProject = sinon.stub().callsArgWith(2, null, @project)
			@handler.createBasicProject(ownerId, projectName, @callback)

		it "should create a blank project first", ->
			@handler.createBlankProject.calledWith(ownerId, projectName)
				.should.equal true

		it 'should insert main.tex', ->
			@ProjectEntityUpdateHandler.addDoc.calledWith(project_id, rootFolderId, "main.tex", ["mainbasic.tex", "lines"], ownerId)
				.should.equal true

		it 'should set the main doc id', ->
			@ProjectEntityUpdateHandler.setRootDoc.calledWith(project_id, docId).should.equal true

		it 'should build the mainbasic.tex template', ->
			@handler._buildTemplate
				.calledWith("mainbasic.tex", ownerId, projectName)
				.should.equal true


	describe 'Creating an example project', ->
		beforeEach ->
			@project = new @ProjectModel()
			@handler._buildTemplate = (template_name, user, project_name, callback) ->
				if template_name == "main.tex"
					return callback(null, ["main.tex", "lines"])
				if template_name == "references.bib"
					return callback(null, ["references.bib", "lines"])
				throw new Error("unknown template: #{template_name}")
			sinon.spy @handler, "_buildTemplate"
			@handler.createBlankProject = sinon.stub().callsArgWith(2, null, @project)
			@handler.createExampleProject(ownerId, projectName, @callback)

		it "should create a blank project first", ->
			@handler.createBlankProject.calledWith(ownerId, projectName)
				.should.equal true

		it 'should insert main.tex', ->
			@ProjectEntityUpdateHandler.addDoc
				.calledWith(project_id, rootFolderId, "main.tex", ["main.tex", "lines"], ownerId)
				.should.equal true

		it 'should insert references.bib', ->
			@ProjectEntityUpdateHandler.addDoc
				.calledWith(project_id, rootFolderId, "references.bib", ["references.bib", "lines"], ownerId)
				.should.equal true

		it 'should insert universe.jpg', ->
			@ProjectEntityUpdateHandler.addFile
				.calledWith(
					project_id, rootFolderId, "universe.jpg",
					Path.resolve(__dirname + "/../../../../app/templates/project_files/universe.jpg"),
					null,
					ownerId
				)
				.should.equal true

		it 'should set the main doc id', ->
			@ProjectEntityUpdateHandler.setRootDoc.calledWith(project_id, docId).should.equal true

		it 'should build the main.tex template', ->
			@handler._buildTemplate
				.calledWith("main.tex", ownerId, projectName)
				.should.equal true

		it 'should build the references.bib template', ->
			@handler._buildTemplate
				.calledWith("references.bib", ownerId, projectName)
				.should.equal true


	describe "_buildTemplate", ->

		beforeEach (done)->
			@handler._buildTemplate "main.tex", @user_id, projectName, (err, templateLines)=>
				@template = templateLines.reduce (singleLine, line)-> "#{singleLine}\n#{line}"
				done()

		it "should insert the project name into the template", (done)->
			@template.indexOf(projectName).should.not.equal -1
			done()

		it "should insert the users name into the template", (done)->
			@template.indexOf(@user.first_name).should.not.equal -1
			@template.indexOf(@user.last_name).should.not.equal -1
			done()

		it "should not have undefined in the template", (done)->
			@template.indexOf("undefined").should.equal -1
			done()

		it "should not have any underscore brackets in the output", (done)->
			@template.indexOf("{{").should.equal -1
			@template.indexOf("<%=").should.equal -1
			done()

		it "should put the year in", (done)->
			@template.indexOf(new Date().getUTCFullYear()).should.not.equal -1
			done()
