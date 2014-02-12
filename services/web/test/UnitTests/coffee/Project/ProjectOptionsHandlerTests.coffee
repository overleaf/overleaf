sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Project/ProjectOptionsHandler.js"
SandboxedModule = require('sandboxed-module')

describe 'creating a project', ->
	project_id = "4eecaffcbffa66588e000008"

	beforeEach ->
		@projectModel = class Project
			constructor:(options)->
		@projectModel.update = sinon.spy()

		@handler = SandboxedModule.require modulePath, requires:
			'../../models/Project':{Project:@projectModel}
			'settings-sharelatex': 
				languages:[
					{name: "English", code: "en"}
					{name: "French", code: "fr"}
				]
			'logger-sharelatex':
				log:->
				err:->

	describe 'Setting the compiler', ->
		it 'should perform and update on mongo', (done)->
			@handler.setCompiler project_id, "xeLaTeX", (err)=>
				args = @projectModel.update.args[0]
				args[0]._id.should.equal project_id
				args[1].compiler.should.equal "xelatex"
				done()
			@projectModel.update.args[0][3]()

		it 'should not perform and update on mongo if it is not a reconised compiler', (done)->
			@handler.setCompiler project_id, "something", (err)=>
				@projectModel.update.called.should.equal false
				done()


	describe "setting the spellCheckLanguage", ->

		it 'should perform and update on mongo', (done)->
			@handler.setSpellCheckLanguage project_id, "fr", (err)=>
				args = @projectModel.update.args[0]
				args[0]._id.should.equal project_id
				args[1].spellCheckLanguage.should.equal "fr"
				done()
			@projectModel.update.args[0][3]()


		it 'should not perform and update on mongo if it is not a reconised compiler', (done)->
			@handler.setSpellCheckLanguage project_id, "no a lang", (err)=>
				@projectModel.update.called.should.equal false
				done()

		it 'should perform and update on mongo if the language is blank (means turn it off)', (done)->
			@handler.setSpellCheckLanguage project_id, "", (err)=>
				@projectModel.update.called.should.equal true
				done()
			@projectModel.update.args[0][3]()
