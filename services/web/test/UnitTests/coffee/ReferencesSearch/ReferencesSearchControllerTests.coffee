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
			'logger-sharelatex': {
				log: ->
				err: ->
			}
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
					@ReferencesSearchHandler.indexFile
					.calledWith(@project_id, expected_url).should.equal true
					done()
				@controller.indexFile(@req, @res)

		describe 'without a doc_id', ->

			beforeEach ->
				@req.body = {bad: true}

			it 'should produce a 400 response', (done) ->
				@res.send = (status) =>
					status.should.equal 400
					done()
				@controller.indexFile(@req, @res)

		describe 'when the ProjectLocator cannot find the doc', ->

			beforeEach ->
				@req.body = {docId: 'some_weird_id'}
				@ProjectLocator.findElement.callsArgWith(1, new Error('not found'), null)
				@ReferencesSearchHandler.indexFile.callsArgWith(2, null)

			it 'should call ProjectLocator.findElement', (done) ->
				@res.send = (status) =>
					@ProjectLocator.findElement.calledOnce.should.equal true
					arg =
						project_id: @project_id
						element_id: 'some_weird_id',
						type: 'doc'
					@ProjectLocator.findElement.calledWith(arg).should.equal true
					done()
				@controller.indexFile(@req, @res)

			it 'should produce a 500 response', (done) ->
				@res.send = (status) =>
					status.should.equal 500
					done()
				@controller.indexFile(@req, @res)

		describe 'when the ReferencesSearchHandler produces an error', ->

			beforeEach ->
				@req.body = {docId: @doc_id}
				@ProjectLocator.findElement.callsArgWith(1, null, {})
				@ReferencesSearchHandler.indexFile.callsArgWith(2, new Error('something went wrong'))

			it 'should call ReferencesSearchHandler.indexFile', (done) ->
				@res.send = (status) =>
					@ReferencesSearchHandler.indexFile.calledOnce.should.equal true
					expected_url = "http://some.url/project/2222/doc/3333"
					@ReferencesSearchHandler.indexFile.calledWith(@project_id, expected_url).should.equal true
					done()
				@controller.indexFile(@req, @res)

			it 'should produce a 500 response', (done) ->
				@res.send = (status) =>
					status.should.equal 500
					done()
				@controller.indexFile(@req, @res)
