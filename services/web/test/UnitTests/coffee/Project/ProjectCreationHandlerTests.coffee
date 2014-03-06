spies = require('chai-spies')
chai = require('chai').use(spies)
sinon = require("sinon")
should = chai.should()
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
		@versioningApiHandler={enableVersioning: sinon.stub().callsArg(1)}
		@ProjectModel = class Project
			constructor:(options = {})->
				@._id = project_id
				@owner_ref = options.owner_ref
				@name = options.name
			save: sinon.stub().callsArg(0)
			rootFolder:[{
				_id: rootFolderId
				docs: []
			}]
		@FolderModel = class Folder
			constructor:(options)->
				{@name} = options
		@ProjectEntityHandler =
			addDoc: sinon.stub().callsArgWith(5, null, {_id: docId})
			addFile: sinon.stub().callsArg(4)
			setRootDoc: sinon.stub().callsArg(2)

		@user = 
			first_name:"first name here"
			last_name:"last name here"
			ace: 
				spellCheckLanguage:"de"

		@User = findById:sinon.stub().callsArgWith(2, null, @user)
		@callback = sinon.stub()
		@handler = SandboxedModule.require modulePath, requires:
			'../../models/User': User:@User
			'../../models/Project':{Project:@ProjectModel}
			'../../models/Folder':{Folder:@FolderModel}
			'../Versioning/VersioningApiHandler':@versioningApiHandler
			'./ProjectEntityHandler':@ProjectEntityHandler
			'logger-sharelatex': {log:->}

	describe 'Creating a Blank project', ->
		beforeEach ->
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

			it 'should enable versioning', (done)->
				@handler.createBlankProject ownerId, projectName, =>
					@versioningApiHandler.enableVersioning.calledWith(project_id).should.equal true
					done()

			it "should set the language from the user", (done)->
				@handler.createBlankProject ownerId, projectName, (err, project)->
					project.spellCheckLanguage.should.equal "de"
					done()

		describe "with an error", ->
			beforeEach ->
				@ProjectModel::save = sinon.stub().callsArgWith(0, new Error("something went wrong"))
				@handler.createBlankProject ownerId, projectName, @callback
			
			it 'should return the error to the callback', ->
				should.exist @callback.args[0][0]

		it 'enables versioning', (done)->
			@versioningApiHandler.enableVersioning = (enbleVersioningProjectId, callback)->
				project_id.should.equal enbleVersioningProjectId
				done()
			@handler.createBlankProject ownerId, projectName, ->

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
			@ProjectEntityHandler.addDoc.calledWith(project_id, rootFolderId, "main.tex", ["mainbasic.tex", "lines"])
				.should.equal true

		it 'should set the main doc id', ->
			@ProjectEntityHandler.setRootDoc.calledWith(project_id, docId).should.equal true

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
			@ProjectEntityHandler.addDoc
				.calledWith(project_id, rootFolderId, "main.tex", ["main.tex", "lines"])
				.should.equal true

		it 'should insert references.bib', ->
			@ProjectEntityHandler.addDoc
				.calledWith(project_id, rootFolderId, "references.bib", ["references.bib", "lines"])
				.should.equal true

		it 'should insert universe.jpg', ->
			@ProjectEntityHandler.addFile
				.calledWith(
					project_id, rootFolderId, "universe.jpg",
					Path.resolve(__dirname + "/../../../../app/templates/project_files/universe.jpg")
				)
				.should.equal true

		it 'should set the main doc id', ->
			@ProjectEntityHandler.setRootDoc.calledWith(project_id, docId).should.equal true

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
