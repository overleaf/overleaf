SandboxedModule = require('sandboxed-module')
should = require('chai').should()
sinon = require 'sinon'
assert = require("chai").assert
modulePath = "../../../../app/js/Features/ReferencesSearch/ReferencesSearchController"
MockRequest = require "../helpers/MockRequest"
MockResponse = require "../helpers/MockResponse"

describe "ReferencesSearchController", ->

	beforeEach ->
		@projectId = '2222'
		@controller = SandboxedModule.require modulePath, requires:
			'logger-sharelatex': {
				log: ->
				err: ->
			},
			'settings-sharelatex': @settings = {
				apis: {web: {url: 'http://some.url'}}
			},
			'./ReferencesSearchHandler': @ReferencesSearchHandler = {
				index: sinon.stub()
			},
			'../Editor/EditorRealTimeController': @EditorRealTimeController = {
				emitToRoom: sinon.stub()
			}
		@req = new MockRequest()
		@req.params.Project_id = @projectId
		@req.body =
			docIds: @docIds = ['aaa', 'bbb']
			shouldBroadcast: false
		@res = new MockResponse()
		@res.json = sinon.stub()
		@res.send = sinon.stub()
		@fakeResponseData =
			projectId: @projectId,
			keys: ['one', 'two', 'three']

	describe 'index', ->

		describe 'with docIds as an array and shouldBroadcast as false', ->

			beforeEach ->
				@ReferencesSearchHandler.index.callsArgWith(2, null, @fakeResponseData)
				@call = (callback) =>
					@controller.index @req, @res
					callback()

			it 'should call ReferencesSearchHandler.index', (done) ->
				@call () =>
					@ReferencesSearchHandler.index.callCount.should.equal 1
					@ReferencesSearchHandler.index.calledWith(@projectId, @docIds).should.equal true
					done()

			it 'should return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.send.callCount.should.equal 0
					@res.send.calledWith(500).should.equal false
					@res.send.calledWith(400).should.equal false
					done()

			it 'should not call EditorRealTimController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 0
					done()

			describe 'with docIds set to ALL', ->

				beforeEach ->
					@req.body.docIds = 'ALL'

				it 'should still pass the "ALL" value to handler', (done) ->
					@call () =>
						@ReferencesSearchHandler.index.callCount.should.equal 1
						@ReferencesSearchHandler.index.calledWith(@projectId, 'ALL').should.equal true
						done()

				it 'should not produce an error', (done) ->
					@call () =>
						@res.send.callCount.should.equal 0
						@res.send.calledWith(500).should.equal false
						@res.send.calledWith(400).should.equal false
						done()

			describe 'when ReferencesSearchHandler.index produces an error', ->

				beforeEach ->
					@ReferencesSearchHandler.index.callsArgWith(2, new Error('woops'), null)

				it 'should produce an error response', (done) ->
					@call () =>
						@res.send.callCount.should.equal 1
						@res.send.calledWith(500).should.equal true
						done()

		describe 'when shouldBroadcast is true', ->

			beforeEach ->
				@ReferencesSearchHandler.index.callsArgWith(2, null, @fakeResponseData)
				@req.body.shouldBroadcast = true

			it 'should call EditorRealTimeController.emitToRoom', (done) ->
				@call () =>
					@EditorRealTimeController.emitToRoom.callCount.should.equal 1
					done()

			it 'should not produce an error', (done) ->
				@call () =>
					@res.send.callCount.should.equal 0
					@res.send.calledWith(500).should.equal false
					@res.send.calledWith(400).should.equal false
					done()

			it 'should still return data', (done) ->
				@call () =>
					@res.json.callCount.should.equal 1
					@res.json.calledWith(@fakeResponseData).should.equal true
					done()

		describe 'with missing docIds', ->

			beforeEach ->
				delete @req.body.docIds

			it 'should produce an error response', (done) ->
				@call () =>
					@res.send.callCount.should.equal 1
					@res.send.calledWith(400).should.equal true
					done()

			it 'should not call ReferencesSearchHandler.index', (done) ->
				@call () =>
					@ReferencesSearchHandler.index.callCount.should.equal 0
					done()

		describe 'with invalid docIds', ->

			beforeEach ->
				@req.body.docIds = 42

			it 'should produce an error response', (done) ->
				@call () =>
					@res.send.callCount.should.equal 1
					@res.send.calledWith(400).should.equal true
					done()

			it 'should not call ReferencesSearchHandler.index', (done) ->
				@call () =>
					@ReferencesSearchHandler.index.callCount.should.equal 0
					done()
