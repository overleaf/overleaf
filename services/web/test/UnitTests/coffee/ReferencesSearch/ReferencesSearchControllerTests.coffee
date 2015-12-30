SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/ReferencesSearch/ReferencesSearchController"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "ReferencesSearchController", ->

	beforeEach ->
		@project_id = '2222'
		@doc_id = '3333'
		@controller = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {log: ->}
			'settings-sharelatex': @settings = {
				apis: {web: {url: 'http://some.url'}}
			}
			'../Project/ProjectLocator': @ProjectLocator = {findElement: sinon.stub()}
			'./ReferencesSearchHandler': @ReferencesSearchHandler = {indexFile: sinon.stub(), getKeys: sinon.stub()}

	describe 'indexFile', ->

		beforeEach ->
			@req = new MockRequest()
			@req.params.Project_id = @project_id
			@res = new MockResponse()
			@ProjectLocator.findElement.callsArgWith(1, null, {})
			@ReferencesSearchHandler.indexFile.callsArgWith(2, null)

		describe 'with a valid doc_id', ->

			beforeEach ->
				@req.body = {docId: @doc_id}

			it 'should produce a 200 response', (done) ->
				@res.send = (status) =>
					status.should.equal 200
					done()
				@controller.indexFile(@req, @res)

			it 'should call ProjectLocator.findElement', (done) ->
				@res.send = (status) =>
					@ProjectLocator.findElement.calledOnce.should.equal true
					arg =
						project_id: @project_id
						element_id: @doc_id,
						type: 'doc'
					@ProjectLocator.findElement.calledWith(arg).should.equal true
					done()
				@controller.indexFile(@req, @res)

			it 'should call ReferencesSearchHandler.indexFile', (done) ->
				@res.send = (status) =>
					@ReferencesSearchHandler.indexFile.calledOnce.should.equal true
					expected_url = "http://some.url/project/2222/doc/3333"
					@ReferencesSearchHandler.indexFile.calledWith(@project_id, expected_url).should.equal true
					done()
				@controller.indexFile(@req, @res)
