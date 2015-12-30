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
			@res = new MockResponse()
			@ProjectLocator.findElement.callsArgWith(1, null, {})
			@ReferencesSearchHandler.indexFile.callsArgWith(2, null)

		it 'should index the file', (done) ->
			@req.body = {docId: @doc_id}
			@res.send = (status) =>
				status.should.equal 200
				done()
			@controller.indexFile(@req, @res)
